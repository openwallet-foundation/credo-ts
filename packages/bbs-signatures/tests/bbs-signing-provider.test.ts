import type { Wallet, WalletConfig } from '@credo-ts/core'

import { KeyDerivationMethod, KeyType, TypedArrayEncoder, SigningProviderRegistry } from '@credo-ts/core'
import { BBS_SIGNATURE_LENGTH } from '@mattrglobal/bbs-signatures'

import { AskarModuleConfig } from '../../askar/src/AskarModuleConfig'
import { ariesAskar, RegisteredAskarTestWallet } from '../../askar/tests/helpers'
import { testLogger, agentDependencies } from '../../core/tests'
import { Bls12381g2SigningProvider } from '../src'

import { describeSkipNode18 } from './util'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: BBS Signing Provider',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describeSkipNode18('BBS Signing Provider', () => {
  let wallet: Wallet
  const seed = TypedArrayEncoder.fromString('sample-seed-min-of-32-bytes-long')
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    wallet = new RegisteredAskarTestWallet(
      testLogger,
      new agentDependencies.FileSystem(),
      new SigningProviderRegistry([new Bls12381g2SigningProvider()]),
      new AskarModuleConfig({ ariesAskar })
    )
    await wallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  test('Create bls12381g2 keypair', async () => {
    const key = await wallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    expect(key.keyType).toStrictEqual(KeyType.Bls12381g2)
    expect(key.publicKeyBase58).toStrictEqual(
      'yVLZ92FeZ3AYco43LXtJgtM8kUD1WPUyQPw4VwxZ1iYSak85GYGSJwURhVJM4R6ASRGuM9vjjSU91pKbaqTWQgLjPJjFuK8HdDmAHi3thYun9QUGjarrK7BzC11LurcpYqD'
    )
  })

  test('Fail to sign with bls12381g1g2 keypair', async () => {
    const key = await wallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })

    await expect(
      wallet.sign({
        data: message,
        key,
      })
    ).rejects.toThrow(
      'Error signing data with verkey AeAihfn5UFf7y9oesemKE1oLmTwKMRv7fafTepespr3qceF4RUMggAbogkoC8n6rXgtJytq4oGy59DsVHxmNj9WGWwkiRnP3Sz2r924RLVbc2NdP4T7yEPsSFZPsWmLjgnP1vXHpj4bVXNcTmkUmF6mSXinF3HehnQVip14vRFuMzYVxMUh28ofTJzbtUqxMWZQRu. Unsupported keyType: bls12381g1g2'
    )
  })

  test('Create a signature with a bls12381g2 keypair', async () => {
    const bls12381g2Key = await wallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await wallet.sign({
      data: message,
      key: bls12381g2Key,
    })
    expect(signature.length).toStrictEqual(BBS_SIGNATURE_LENGTH)
  })

  test('Verify a signed message with a bls12381g2 publicKey', async () => {
    const bls12381g2Key = await wallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await wallet.sign({
      data: message,
      key: bls12381g2Key,
    })
    await expect(wallet.verify({ key: bls12381g2Key, data: message, signature })).resolves.toStrictEqual(true)
  })
})
