import type { WalletConfig } from '../types'

import { SIGNATURE_LENGTH as ED25519_SIGNATURE_LENGTH } from '@stablelib/ed25519'

import { agentDependencies } from '../../tests/helpers'
import testLogger from '../../tests/logger'
import { KeyType } from '../crypto'
import { SigningProviderRegistry } from '../crypto/signing-provider'
import { KeyDerivationMethod } from '../types'
import { TypedArrayEncoder } from '../utils'

import { IndyWallet } from './IndyWallet'
import { WalletError } from './error'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Wallet: IndyWalletTest',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

const walletConfigWithMasterSecretId: WalletConfig = {
  id: 'Wallet: WalletTestWithMasterSecretId',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
  masterSecretId: 'customMasterSecretId',
}

describe('IndyWallet', () => {
  let indyWallet: IndyWallet

  const privateKey = TypedArrayEncoder.fromString('sample-seed')
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    indyWallet = new IndyWallet(agentDependencies, testLogger, new SigningProviderRegistry([]))
    await indyWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await indyWallet.delete()
  })

  test('Get the public DID', async () => {
    await indyWallet.initPublicDid({ seed: '000000000000000000000000Trustee9' })
    expect(indyWallet.publicDid).toMatchObject({
      did: expect.any(String),
      verkey: expect.any(String),
    })
  })

  test('Get the Master Secret', () => {
    expect(indyWallet.masterSecretId).toEqual('Wallet: IndyWalletTest')
  })

  test('Get the wallet handle', () => {
    expect(indyWallet.handle).toEqual(expect.any(Number))
  })

  test('Initializes a public did', async () => {
    await indyWallet.initPublicDid({ seed: '00000000000000000000000Forward01' })

    expect(indyWallet.publicDid).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  test('Generate Nonce', async () => {
    await expect(indyWallet.generateNonce()).resolves.toEqual(expect.any(String))
  })

  test('Create ed25519 keypair from private key', async () => {
    const key = await indyWallet.createKey({
      privateKey: TypedArrayEncoder.fromString('2103de41b4ae37e8e28586d84a342b67'),
      keyType: KeyType.Ed25519,
    })

    expect(key).toMatchObject({
      keyType: KeyType.Ed25519,
    })
  })

  test('Fail to create ed25519 keypair from seed', async () => {
    await expect(indyWallet.createKey({ privateKey, keyType: KeyType.Ed25519 })).rejects.toThrowError(WalletError)
  })

  test('Fail to create x25519 keypair', async () => {
    await expect(indyWallet.createKey({ privateKey, keyType: KeyType.X25519 })).rejects.toThrowError(WalletError)
  })

  test('Create a signature with a ed25519 keypair', async () => {
    const ed25519Key = await indyWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await indyWallet.sign({
      data: message,
      key: ed25519Key,
    })
    expect(signature.length).toStrictEqual(ED25519_SIGNATURE_LENGTH)
  })

  test('Verify a signed message with a ed25519 publicKey', async () => {
    const ed25519Key = await indyWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await indyWallet.sign({
      data: message,
      key: ed25519Key,
    })
    await expect(indyWallet.verify({ key: ed25519Key, data: message, signature })).resolves.toStrictEqual(true)
  })

  test('masterSecretId is equal to wallet ID by default', async () => {
    expect(indyWallet.masterSecretId).toEqual(walletConfig.id)
  })
})

describe('IndyWallet with custom Master Secret Id', () => {
  let indyWallet: IndyWallet

  beforeEach(async () => {
    indyWallet = new IndyWallet(agentDependencies, testLogger, new SigningProviderRegistry([]))
    await indyWallet.createAndOpen(walletConfigWithMasterSecretId)
  })

  afterEach(async () => {
    await indyWallet.delete()
  })

  test('masterSecretId is set by config', async () => {
    expect(indyWallet.masterSecretId).toEqual(walletConfigWithMasterSecretId.masterSecretId)
  })
})
