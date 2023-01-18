import type { WalletConfig } from '@aries-framework/core'

import { KeyType, SigningProviderRegistry, TypedArrayEncoder, KeyDerivationMethod } from '@aries-framework/core'
import { NodeJSAriesAskar } from 'aries-askar-test-nodejs'
import { registerAriesAskar, Store } from 'aries-askar-test-shared'

import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarWallet } from '../AskarWallet'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: askarWalletTest',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describe('askarWallet', () => {
  let askarWallet: AskarWallet

  const seed = 'sample-seed'
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    registerAriesAskar({ askar: new NodeJSAriesAskar() })
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  test('Get the Master Secret', () => {
    expect(askarWallet.masterSecretId).toEqual('Wallet: askarWalletTest')
  })

  test('Get the wallet handle', () => {
    expect(askarWallet.handle).toEqual(expect.any(Store))
  })

  test('Generate Nonce', async () => {
    await expect(askarWallet.generateNonce()).resolves.toEqual(expect.any(String))
  })

  test('Create ed25519 keypair', async () => {
    await expect(
      askarWallet.createKey({ seed: '2103de41b4ae37e8e28586d84a342b67', keyType: KeyType.Ed25519 })
    ).resolves.toMatchObject({
      keyType: KeyType.Ed25519,
    })
  })

  test('Create x25519 keypair', async () => {
    await expect(askarWallet.createKey({ seed, keyType: KeyType.X25519 })).resolves.toMatchObject({
      keyType: KeyType.X25519,
    })
  })

  test('Create a signature with a ed25519 keypair', async () => {
    const ed25519Key = await askarWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await askarWallet.sign({
      data: message,
      key: ed25519Key,
    })
    expect(signature.length).toStrictEqual(64)
  })

  test('Verify a signed message with a ed25519 publicKey', async () => {
    const ed25519Key = await askarWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await askarWallet.sign({
      data: message,
      key: ed25519Key,
    })
    await expect(askarWallet.verify({ key: ed25519Key, data: message, signature })).resolves.toStrictEqual(true)
  })

  test('masterSecretId is equal to wallet ID by default', async () => {
    expect(askarWallet.masterSecretId).toEqual(walletConfig.id)
  })
})

describe('AskarWallet key rotation', () => {
  let askarWallet: AskarWallet

  beforeEach(async () => {
    registerAriesAskar({ askar: new NodeJSAriesAskar() })
  })

  afterEach(async () => {
    if (askarWallet) {
      await askarWallet.delete()
    }
  })

  // TODO: Open, Close (duplicate, non existant, invalid key, etc.)

  test('Rotate key', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    await askarWallet.createAndOpen({ ...walletConfig, id: 'keyRotation', key: initialKey })

    await askarWallet.close()

    const newKey = Store.generateRawKey()
    await askarWallet.rotateKey({ ...walletConfig, id: 'keyRotation', key: initialKey, rekey: newKey })

    await askarWallet.close()

    await expect(askarWallet.open({ ...walletConfig, id: 'keyRotation', key: initialKey })).rejects.toThrowError()

    await askarWallet.open({ ...walletConfig, id: 'keyRotation', key: newKey })

    await askarWallet.close()
  })
})
