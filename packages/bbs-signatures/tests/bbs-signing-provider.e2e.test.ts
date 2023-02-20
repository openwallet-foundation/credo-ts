import type { Wallet, WalletConfig } from '@aries-framework/core'

import {
  KeyDerivationMethod,
  KeyType,
  WalletError,
  TypedArrayEncoder,
  SigningProviderRegistry,
} from '@aries-framework/core'
import { BBS_SIGNATURE_LENGTH } from '@mattrglobal/bbs-signatures'

import testLogger from '../../core/tests/logger'
import { IndySdkWallet } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { Bls12381g2SigningProvider } from '../src'

import { describeSkipNode17And18 } from './util'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: BBS Signing Provider',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describeSkipNode17And18('BBS Signing Provider', () => {
  let wallet: Wallet
  const seed = TypedArrayEncoder.fromString('sample-seed-min-of-32-bytes-long')
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    wallet = new IndySdkWallet(indySdk, testLogger, new SigningProviderRegistry([new Bls12381g2SigningProvider()]))
    await wallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  test('Create bls12381g2 keypair', async () => {
    await expect(wallet.createKey({ seed, keyType: KeyType.Bls12381g2 })).resolves.toMatchObject({
      publicKeyBase58:
        '25TvGExLTWRTgn9h2wZuohrQmmLafXiacY4dhv66wcbY8pLbuNTBRMTgWVcPKh2wsEyrRPmnhLdc4C7LEcJ2seoxzBkoydJEdQD8aqg5dw8wesBTS9Twg8EjuFG1WPRAiERd',
      keyType: KeyType.Bls12381g2,
    })
  })

  test('Fail to create bls12381g1g2 keypair', async () => {
    await expect(wallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })).rejects.toThrowError(WalletError)
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
