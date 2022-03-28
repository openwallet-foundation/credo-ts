import { BBS_SIGNATURE_LENGTH } from '@mattrglobal/bbs-signatures'
import { SIGNATURE_LENGTH as ED25519_SIGNATURE_LENGTH } from '@stablelib/ed25519'

import { getBaseConfig } from '../../tests/helpers'
import { Agent } from '../agent/Agent'
import { KeyType } from '../crypto'
import { TypedArrayEncoder } from '../utils'

import { IndyWallet } from './IndyWallet'
import { WalletError } from './error'

describe('IndyWallet', () => {
  let indyWallet: IndyWallet
  let agent: Agent
  const seed = 'sample-seed'
  const message = TypedArrayEncoder.fromString('sample-message')

  beforeEach(async () => {
    const { config, agentDependencies } = getBaseConfig('IndyWalletTest')
    agent = new Agent(config, agentDependencies)
    indyWallet = agent.injectionContainer.resolve(IndyWallet)
    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('Get the public DID', () => {
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

  test('Create DID', async () => {
    const didInfo = await indyWallet.createDid({ seed: '00000000000000000000000Forward01' })
    expect(didInfo).toMatchObject({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  test('Generate Nonce', async () => {
    await expect(indyWallet.generateNonce()).resolves.toEqual(expect.any(String))
  })

  test('Create ed25519 keypair', async () => {
    await expect(
      indyWallet.createKey({ seed: '2103de41b4ae37e8e28586d84a342b67', keyType: KeyType.Ed25519 })
    ).resolves.toMatchObject({
      keyType: KeyType.Ed25519,
    })
  })

  test('Create blsg12381g1 keypair', async () => {
    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g1 })).resolves.toMatchObject({
      publicKeyBase58: '6RhvX1RK5rA9uXdTtV6WvHWNQqcCW86BQxz1aBPr6ebBcppCYMD3LLy7QLg4cGcWaq',
      keyType: KeyType.Bls12381g1,
    })
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

  test('Fail to create x25519 keypair', async () => {
    await expect(indyWallet.createKey({ seed, keyType: KeyType.X25519 })).rejects.toThrowError(WalletError)
  })

  test('Create a signature with a ed25519 keypair', async () => {
    const ed25519Key = await indyWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await indyWallet.sign({
      data: message,
      key: ed25519Key,
    })
    expect(signature.length).toStrictEqual(ED25519_SIGNATURE_LENGTH)
  })

  test('Create a signature with a bls12381g2 keypair', async () => {
    const bls12381g2Key = await indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await indyWallet.sign({
      data: message,
      key: bls12381g2Key,
    })
    expect(signature.length).toStrictEqual(BBS_SIGNATURE_LENGTH)
  })

  test('Fail to create a signature with a bls12381g1 keypair', async () => {
    const bls12381g1Key = await indyWallet.createKey({ seed, keyType: KeyType.Bls12381g1 })
    await expect(
      indyWallet.sign({
        data: message,
        key: bls12381g1Key,
      })
    ).rejects.toThrowError(WalletError)
  })

  test('Verify a signed message with a ed25519 publicKey', async () => {
    const ed25519Key = await indyWallet.createKey({ keyType: KeyType.Ed25519 })
    const signature = await indyWallet.sign({
      data: message,
      key: ed25519Key,
    })
    await expect(indyWallet.verify({ key: ed25519Key, data: message, signature })).resolves.toStrictEqual(true)
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
