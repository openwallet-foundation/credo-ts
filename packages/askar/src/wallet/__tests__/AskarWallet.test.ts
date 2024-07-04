import type {
  SigningProvider,
  WalletConfig,
  CreateKeyPairOptions,
  KeyPair,
  SignOptions,
  VerifyOptions,
} from '@credo-ts/core'

import {
  WalletKeyExistsError,
  Key,
  WalletError,
  WalletDuplicateError,
  WalletNotFoundError,
  WalletInvalidKeyError,
  KeyType,
  SigningProviderRegistry,
  TypedArrayEncoder,
  KeyDerivationMethod,
  Buffer,
} from '@credo-ts/core'
import { Store } from '@hyperledger/aries-askar-shared'

import { KeyBackend } from '../../../../core/src/crypto/KeyBackend'
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

  const seed = TypedArrayEncoder.fromString('sample-seed-min-of-32-bytes-long')
  const privateKey = TypedArrayEncoder.fromString('2103de41b4ae37e8e28586d84a342b67')
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  test('supportedKeyTypes', () => {
    expect(askarWallet.supportedKeyTypes).toEqual([
      KeyType.Ed25519,
      KeyType.X25519,
      KeyType.Bls12381g1,
      KeyType.Bls12381g2,
      KeyType.Bls12381g1g2,
      KeyType.P256,
      KeyType.K256,
    ])
  })

  test('Get the wallet store', () => {
    expect(askarWallet.store).toEqual(expect.any(Store))
  })

  test('Generate Nonce', async () => {
    const nonce = await askarWallet.generateNonce()

    expect(nonce).toMatch(/[0-9]+/)
  })

  test('Create ed25519 keypair from seed', async () => {
    const key = await askarWallet.createKey({
      seed,
      keyType: KeyType.Ed25519,
    })

    expect(key).toMatchObject({
      keyType: KeyType.Ed25519,
    })
  })

  test('Create ed25519 keypair from private key', async () => {
    const key = await askarWallet.createKey({
      privateKey,
      keyType: KeyType.Ed25519,
    })

    expect(key).toMatchObject({
      keyType: KeyType.Ed25519,
    })
  })

  test('Attempt to create ed25519 keypair from both seed and private key', async () => {
    await expect(
      askarWallet.createKey({
        privateKey,
        seed,
        keyType: KeyType.Ed25519,
      })
    ).rejects.toThrow()
  })

  test('Create x25519 keypair', async () => {
    await expect(askarWallet.createKey({ seed, keyType: KeyType.X25519 })).resolves.toMatchObject({
      keyType: KeyType.X25519,
    })
  })

  test('Create P-256 keypair', async () => {
    await expect(
      askarWallet.createKey({ seed: Buffer.concat([seed, seed]), keyType: KeyType.P256 })
    ).resolves.toMatchObject({
      keyType: KeyType.P256,
    })
  })

  test('throws WalletKeyExistsError when a key already exists', async () => {
    const privateKey = TypedArrayEncoder.fromString('2103de41b4ae37e8e28586d84a342b68')
    await expect(askarWallet.createKey({ privateKey, keyType: KeyType.Ed25519 })).resolves.toEqual(expect.any(Key))
    await expect(askarWallet.createKey({ privateKey, keyType: KeyType.Ed25519 })).rejects.toThrow(WalletKeyExistsError)
  })

  test('Fail to create a P384 keypair', async () => {
    await expect(askarWallet.createKey({ seed, keyType: KeyType.P384 })).rejects.toThrow(WalletError)
  })

  test('Fail to create a P256 keypair in hardware', async () => {
    await expect(
      askarWallet.createKey({ keyType: KeyType.P256, keyBackend: KeyBackend.SecureElement })
    ).rejects.toThrow(WalletError)
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

  test('Create K-256 keypair', async () => {
    await expect(
      askarWallet.createKey({ seed: Buffer.concat([seed, seed]), keyType: KeyType.K256 })
    ).resolves.toMatchObject({
      keyType: KeyType.K256,
    })
  })

  test('Verify a signed message with a k256 publicKey', async () => {
    const k256Key = await askarWallet.createKey({ keyType: KeyType.K256 })
    const signature = await askarWallet.sign({
      data: message,
      key: k256Key,
    })
    await expect(askarWallet.verify({ key: k256Key, data: message, signature })).resolves.toStrictEqual(true)
  })
})

describe.skip('Currently, all KeyTypes are supported by Askar natively', () => {
  describe('AskarWallet with custom signing provider', () => {
    let askarWallet: AskarWallet

    const seed = TypedArrayEncoder.fromString('sample-seed')
    const message = TypedArrayEncoder.fromString('sample-message')

    class DummySigningProvider implements SigningProvider {
      public keyType: KeyType = KeyType.Bls12381g1g2

      public async createKeyPair(options: CreateKeyPairOptions): Promise<KeyPair> {
        return {
          publicKeyBase58: encodeToBase58(Buffer.from(options.seed || TypedArrayEncoder.fromString('publicKeyBase58'))),
          privateKeyBase58: 'privateKeyBase58',
          keyType: KeyType.Bls12381g1g2,
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      public async sign(_options: SignOptions): Promise<Buffer> {
        return new Buffer('signed')
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      public async verify(_options: VerifyOptions): Promise<boolean> {
        return true
      }
    }

    beforeEach(async () => {
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
      await askarWallet.createKey({ seed: TypedArrayEncoder.fromString('keybase58'), keyType: KeyType.Bls12381g1g2 })

      await expect(
        askarWallet.createKey({ seed: TypedArrayEncoder.fromString('keybase58'), keyType: KeyType.Bls12381g1g2 })
      ).rejects.toThrow(WalletError)
    })
  })
})

describe('AskarWallet management', () => {
  let askarWallet: AskarWallet

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
    ).rejects.toThrow(WalletDuplicateError)
  })

  test('Open', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    const wrongKey = Store.generateRawKey()

    // Create and open wallet
    await askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Open', key: initialKey })

    // Close and try to re-opening it with a wrong key
    await askarWallet.close()
    await expect(askarWallet.open({ ...walletConfig, id: 'AskarWallet Open', key: wrongKey })).rejects.toThrow(
      WalletInvalidKeyError
    )

    // Try to open a non existent wallet
    await expect(
      askarWallet.open({ ...walletConfig, id: 'AskarWallet Open - Non existent', key: initialKey })
    ).rejects.toThrow(WalletNotFoundError)
  })

  test('Rotate key', async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

    const initialKey = Store.generateRawKey()
    await askarWallet.createAndOpen({ ...walletConfig, id: 'AskarWallet Key Rotation', key: initialKey })

    await askarWallet.close()

    const newKey = Store.generateRawKey()
    await askarWallet.rotateKey({
      ...walletConfig,
      id: 'AskarWallet Key Rotation',
      key: initialKey,
      rekey: newKey,
      rekeyDerivationMethod: KeyDerivationMethod.Raw,
    })

    await askarWallet.close()

    await expect(
      askarWallet.open({ ...walletConfig, id: 'AskarWallet Key Rotation', key: initialKey })
    ).rejects.toThrow(WalletInvalidKeyError)

    await askarWallet.open({ ...walletConfig, id: 'AskarWallet Key Rotation', key: newKey })

    await askarWallet.close()
  })
})
