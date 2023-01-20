import type {
  SigningProvider,
  WalletConfig,
  CreateKeyPairOptions,
  KeyPair,
  SignOptions,
  VerifyOptions,
} from '@aries-framework/core'

import {
  WalletError,
  WalletDuplicateError,
  WalletNotFoundError,
  WalletInvalidKeyError,
  KeyType,
  SigningProviderRegistry,
  TypedArrayEncoder,
  KeyDerivationMethod,
  Buffer,
} from '@aries-framework/core'
import { NodeJSAriesAskar } from 'aries-askar-test-nodejs'
import { registerAriesAskar, Store } from 'aries-askar-test-shared'

import { encodeToBase58 } from '../../../../core/src/utils/base58'
import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarWallet } from '../AskarWallet'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: AskarWalletTest',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describe('AskarWallet basic operations', () => {
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

  test('Get the wallet store', () => {
    expect(askarWallet.store).toEqual(expect.any(Store))
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

  test('Fail to create a Bls12381g1g2 keypair', async () => {
    await expect(askarWallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })).rejects.toThrowError(WalletError)
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

describe('AskarWallet with custom signing provider', () => {
  let askarWallet: AskarWallet

  const seed = 'sample-seed'
  const message = TypedArrayEncoder.fromString('sample-message')

  class DummySigningProvider implements SigningProvider {
    public keyType: KeyType = KeyType.Bls12381g1g2

    public async createKeyPair(options: CreateKeyPairOptions): Promise<KeyPair> {
      return {
        publicKeyBase58: encodeToBase58(Buffer.from(options.seed || 'publicKeyBase58')),
        privateKeyBase58: 'privateKeyBase58',
        keyType: KeyType.Bls12381g1g2,
      }
    }

    public async sign(options: SignOptions): Promise<Buffer> {
      return new Buffer('signed')
    }

    public async verify(options: VerifyOptions): Promise<boolean> {
      return true
    }
  }

  beforeEach(async () => {
    registerAriesAskar({ askar: new NodeJSAriesAskar() })

    askarWallet = new AskarWallet(
      testLogger,
      new agentDependencies.FileSystem(),
      new SigningProviderRegistry([new DummySigningProvider()])
    )
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  test('Create custom keypair and use it for signing', async () => {
    const key = await askarWallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })
    expect(key.keyType).toBe(KeyType.Bls12381g1g2)
    expect(key.publicKeyBase58).toBe(encodeToBase58(Buffer.from(seed)))

    const signature = await askarWallet.sign({
      data: message,
      key,
    })

    expect(signature).toBeInstanceOf(Buffer)
  })

  test('Create custom keypair and use it for verifying', async () => {
    const key = await askarWallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })
    expect(key.keyType).toBe(KeyType.Bls12381g1g2)
    expect(key.publicKeyBase58).toBe(encodeToBase58(Buffer.from(seed)))

    const signature = await askarWallet.verify({
      data: message,
      signature: new Buffer('signature'),
      key,
    })

    expect(signature).toBeTruthy()
  })

  test('Attempt to create the same custom keypair twice', async () => {
    await askarWallet.createKey({ seed: 'keybase58', keyType: KeyType.Bls12381g1g2 })

    await expect(askarWallet.createKey({ seed: 'keybase58', keyType: KeyType.Bls12381g1g2 })).rejects.toThrow(
      WalletError
    )
  })
})

describe('AskarWallet management', () => {
  let askarWallet: AskarWallet

  beforeEach(async () => {
    registerAriesAskar({ askar: new NodeJSAriesAskar() })
  })

  afterEach(async () => {
    if (askarWallet) {
      await askarWallet.delete()
    }
  })

  test('Create', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    const anotherKey = Store.generateRawKey()

    // Create and open wallet
    await askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Create', key: initialKey })

    // Close and try to re-create it
    await askarWallet.close()
    await expect(
      askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Create', key: anotherKey })
    ).rejects.toThrowError(WalletDuplicateError)
  })

  test('Open', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    const wrongKey = Store.generateRawKey()

    // Create and open wallet
    await askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Open', key: initialKey })

    // Close and try to re-opening it with a wrong key
    await askarWallet.close()
    await expect(askarWallet.open({ ...walletConfig, id: 'AskarWallet Open', key: wrongKey })).rejects.toThrowError(
      WalletInvalidKeyError
    )

    // Try to open a non existent wallet
    await expect(
      askarWallet.open({ ...walletConfig, id: 'AskarWallet Open - Non existent', key: initialKey })
    ).rejects.toThrowError(WalletNotFoundError)
  })

  test('Rotate key', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    await askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Key Rotation', key: initialKey })

    await askarWallet.close()

    const newKey = Store.generateRawKey()
    await askarWallet.rotateKey({ ...walletConfig, id: 'AskarWallet Key Rotation', key: initialKey, rekey: newKey })

    await askarWallet.close()

    await expect(
      askarWallet.open({ ...walletConfig, id: 'AskarWallet Key Rotation', key: initialKey })
    ).rejects.toThrowError(WalletInvalidKeyError)

    await askarWallet.open({ ...walletConfig, id: 'AskarWallet Key Rotation', key: newKey })

    await askarWallet.close()
  })
})
