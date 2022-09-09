import type { WalletConfig } from '@aries-framework/core'

import {
  KeyDerivationMethod,
  KeyType,
  WalletError,
  TypedArrayEncoder,
  SigningProviderRegistry,
  IndyWallet,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { BBS_SIGNATURE_LENGTH } from '@mattrglobal/bbs-signatures'

import testLogger from '../../core/tests/logger'
import { Bls12381g2SigningProvider } from '../src'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: IndyWalletTest',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describe('BBS Signing Provider', () => {
  let indyWallet: IndyWallet
  const seed = 'sample-seed'
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    indyWallet = new IndyWallet(
      agentDependencies,
      testLogger,
      new SigningProviderRegistry([new Bls12381g2SigningProvider()])
    )
    await indyWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await indyWallet.delete()
  })

  test('Create bls12381g2 keypair', async () => {
    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })).resolves.toMatchObject({
      publicKeyBase58:
        't54oLBmhhRcDLUyWTvfYRWw8VRXRy1p43pVm62hrpShrYPuHe9WNAgS33DPfeTK6xK7iPrtJDwCHZjYgbFYDVTJHxXex9xt2XEGF8D356jBT1HtqNeucv3YsPLfTWcLcpFA',
      keyType: KeyType.Bls12381g2,
    })
  })

  test('Fail to create bls12381g1g2 keypair', async () => {
    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })).rejects.toThrowError(WalletError)
  })

  test('Create a signature with a bls12381g2 keypair', async () => {
    const bls12381g2Key = await indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await indyWallet.sign({
      data: message,
      key: bls12381g2Key,
    })
    expect(signature.length).toStrictEqual(BBS_SIGNATURE_LENGTH)
  })

  test('Verify a signed message with a bls12381g2 publicKey', async () => {
    const bls12381g2Key = await indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await indyWallet.sign({
      data: message,
      key: bls12381g2Key,
    })
    await expect(indyWallet.verify({ key: bls12381g2Key, data: message, signature })).resolves.toStrictEqual(true)
  })
})
