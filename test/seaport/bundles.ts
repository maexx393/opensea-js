import {
  assert,
} from 'chai'

import { before } from 'mocha'

import {
  suite,
  test,
} from 'mocha-typescript'

import { OpenSeaPort } from '../../src/index'
import * as Web3 from 'web3'
import { Network, WyvernSchemaName, Asset } from '../../src/types'
import { ALEX_ADDRESS, DIGITAL_ART_CHAIN_ADDRESS, DIGITAL_ART_CHAIN_TOKEN_ID, MYTHEREUM_TOKEN_ID, MYTHEREUM_ADDRESS, MAINNET_API_KEY, DISSOLUTION_TOKEN_ID, SPIRIT_CLASH_TOKEN_ID, BENZENE_ADDRESS } from '../constants'
import { testFeesMakerOrder } from './fees'
import { testMatchingNewOrder } from './orders' 
import {
  MAINNET_PROVIDER_URL,
  NULL_ADDRESS,
  ENJIN_ADDRESS,
} from '../../src/constants'

const provider = new Web3.providers.HttpProvider(MAINNET_PROVIDER_URL)

const client = new OpenSeaPort(provider, {
  networkName: Network.Main,
  apiKey: MAINNET_API_KEY
}, line => console.info(`MAINNET: ${line}`))

const assetsForBundleOrder: Asset[] = [
  { tokenId: MYTHEREUM_TOKEN_ID.toString(), tokenAddress: MYTHEREUM_ADDRESS },
  { tokenId: DIGITAL_ART_CHAIN_TOKEN_ID.toString(), tokenAddress: DIGITAL_ART_CHAIN_ADDRESS },
]

const fungibleAssetsForBundleOrder: Asset[] = [
  { tokenAddress: BENZENE_ADDRESS, tokenId: null, schemaName: WyvernSchemaName.ERC20 }
]

const semiFungibleAssetsForBundleOrder: Asset[] = [
  { tokenId: DISSOLUTION_TOKEN_ID, tokenAddress: ENJIN_ADDRESS, schemaName: WyvernSchemaName.ERC1155 },
  { tokenId: SPIRIT_CLASH_TOKEN_ID, tokenAddress: ENJIN_ADDRESS, schemaName: WyvernSchemaName.ERC1155 },
]

let wethAddress: string
let manaAddress: string

suite('seaport: bundles', () => {

  before(async () => {
    wethAddress = (await client.api.getPaymentTokens({ symbol: 'WETH'})).tokens[0].address
    manaAddress = (await client.api.getPaymentTokens({ symbol: 'MANA'})).tokens[0].address
  })

  test('Matches heterogenous bundle buy order', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const amountInEth = 0.01

    const order = await client._makeBundleBuyOrder({
      assets: assetsForBundleOrder,
      quantities: [1, 1],
      accountAddress,
      startAmount: amountInEth,
      extraBountyBasisPoints: 0,
      expirationTime: 0,
      paymentTokenAddress: wethAddress
    })

    assert.equal(order.paymentToken, wethAddress)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth)
    assert.equal(order.extra.toNumber(), 0)
    assert.equal(order.expirationTime.toNumber(), 0)
    testFeesMakerOrder(order, undefined)

    await client._buyOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test('Matches homogenous bundle buy order', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const amountInToken = 10

    const order = await client._makeBundleBuyOrder({
      assets: [{ tokenId: MYTHEREUM_TOKEN_ID.toString(), tokenAddress: MYTHEREUM_ADDRESS }],
      quantities: [1],
      accountAddress,
      startAmount: amountInToken,
      extraBountyBasisPoints: 0,
      expirationTime: 0,
      paymentTokenAddress: manaAddress
    })

    const asset = await client.api.getAsset(MYTHEREUM_ADDRESS, MYTHEREUM_TOKEN_ID.toString())

    assert.equal(order.paymentToken, manaAddress)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken)
    assert.equal(order.extra.toNumber(), 0)
    assert.equal(order.expirationTime.toNumber(), 0)
    testFeesMakerOrder(order, asset.assetContract)

    await client._buyOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test('Matches fixed heterogenous bountied bundle sell order', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const amountInEth = 1
    const bountyPercent = 1.5

    const order = await client._makeBundleSellOrder({
      bundleName: "Test Bundle",
      bundleDescription: "This is a test with different types of assets",
      assets: assetsForBundleOrder,
      quantities: [1, 1],
      accountAddress,
      startAmount: amountInEth,
      extraBountyBasisPoints: bountyPercent * 100,
      expirationTime: 0,
      paymentTokenAddress: NULL_ADDRESS,
      waitForHighestBid: false,
      buyerAddress: NULL_ADDRESS
    })

    assert.equal(order.paymentToken, NULL_ADDRESS)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth)
    assert.equal(order.extra.toNumber(), 0)
    assert.equal(order.expirationTime.toNumber(), 0)
    testFeesMakerOrder(order, undefined, bountyPercent * 100)

    await client._sellOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test('Matches homogenous, bountied bundle sell order', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const amountInEth = 1
    const bountyPercent = 0.8

    const order = await client._makeBundleSellOrder({
      bundleName: "Test Homogenous Bundle",
      bundleDescription: "This is a test with one type of asset",
      assets: [{ tokenId: MYTHEREUM_TOKEN_ID.toString(), tokenAddress: MYTHEREUM_ADDRESS }],
      quantities: [1],
      accountAddress,
      startAmount: amountInEth,
      extraBountyBasisPoints: bountyPercent * 100,
      expirationTime: 0,
      paymentTokenAddress: NULL_ADDRESS,
      waitForHighestBid: false,
      buyerAddress: NULL_ADDRESS
    })

    const asset = await client.api.getAsset(MYTHEREUM_ADDRESS, MYTHEREUM_TOKEN_ID.toString())

    assert.equal(order.paymentToken, NULL_ADDRESS)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth)
    assert.equal(order.extra.toNumber(), 0)
    assert.equal(order.expirationTime.toNumber(), 0)
    testFeesMakerOrder(order, asset.assetContract, bountyPercent * 100)

    await client._sellOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test('Matches a new bundle sell order for an ERC-20 token (MANA)', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const token = (await client.api.getPaymentTokens({ symbol: 'MANA'})).tokens[0]
    const amountInToken = 2.422

    const order = await client._makeBundleSellOrder({
      bundleName: "Test Bundle",
      bundleDescription: "This is a test with different types of assets",
      assets: assetsForBundleOrder,
      quantities: [1, 1],
      accountAddress,
      startAmount: amountInToken,
      paymentTokenAddress: token.address,
      extraBountyBasisPoints: 0,
      expirationTime: 0,
      waitForHighestBid: false,
      buyerAddress: NULL_ADDRESS
    })

    assert.equal(order.paymentToken, token.address)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, token.decimals) * amountInToken)
    assert.equal(order.extra.toNumber(), 0)
    assert.equal(order.expirationTime.toNumber(), 0)

    await client._sellOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test('Matches Dutch bundle order for different approve-all assets', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day from now
    const amountInEth = 1

    const order = await client._makeBundleSellOrder({
      bundleName: "Test Bundle",
      bundleDescription: "This is a test with different types of assets",
      assets: assetsForBundleOrder,
      quantities: [1, 1],
      accountAddress,
      startAmount: amountInEth,
      endAmount: 0,
      expirationTime,
      extraBountyBasisPoints: 0,
      waitForHighestBid: false,
      buyerAddress: NULL_ADDRESS,
      paymentTokenAddress: NULL_ADDRESS
    })

    assert.equal(order.paymentToken, NULL_ADDRESS)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth)
    assert.equal(order.extra.toNumber(), Math.pow(10, 18) * amountInEth)
    assert.equal(order.expirationTime.toNumber(), expirationTime)

    await client._sellOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

  test.only('Matches bundle order for misordered assets with different schemas', async () => {
    const accountAddress = ALEX_ADDRESS
    const takerAddress = ALEX_ADDRESS
    const amountInEth = 1

    const order = await client._makeBundleSellOrder({
      bundleName: "Test Bundle",
      bundleDescription: "This is a test with different schemas of assets",
      assets: [
        ...assetsForBundleOrder,
        ...fungibleAssetsForBundleOrder,
        ...semiFungibleAssetsForBundleOrder],
      quantities: [1, 1, 12, 2, 1],
      accountAddress,
      startAmount: amountInEth,
      expirationTime: 0,
      extraBountyBasisPoints: 0,
      waitForHighestBid: false,
      buyerAddress: NULL_ADDRESS,
      paymentTokenAddress: NULL_ADDRESS
    })

    assert.equal(order.paymentToken, NULL_ADDRESS)
    assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth)

    await client._sellOrderValidationAndApprovals({ order, accountAddress })
    // Make sure match is valid
    await testMatchingNewOrder(order, takerAddress)
  })

})