import { BBS_SIGNATURE_LENGTH, bls12381toBbs, generateBls12381G2KeyPair, sign } from '@mattrglobal/bbs-signatures'

import { getBaseConfig } from '../../tests/helpers'
import { Agent } from '../agent/Agent'
import { Key, KeyType } from '../crypto'
import { TypedArrayEncoder } from '../utils'
import { Buffer } from '../utils/buffer'

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

  xtest('Initializes a public did', async () => {
    await indyWallet.initPublicDid({ seed: '00000000000000000000000Forward01' })

    expect(indyWallet.publicDid).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  test('Create every keypair', async () => {
    await expect(
      indyWallet.createKey({ seed: '2103de41b4ae37e8e28586d84a342b67', keyType: KeyType.Ed25519 })
    ).resolves.toMatchObject({
      keyType: KeyType.Ed25519,
    })

    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g1 })).resolves.toMatchObject({
      publicKeyBase58: '6RhvX1RK5rA9uXdTtV6WvHWNQqcCW86BQxz1aBPr6ebBcppCYMD3LLy7QLg4cGcWaq',
      keyType: KeyType.Bls12381g1,
    })

    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })).resolves.toMatchObject({
      publicKeyBase58:
        't54oLBmhhRcDLUyWTvfYRWw8VRXRy1p43pVm62hrpShrYPuHe9WNAgS33DPfeTK6xK7iPrtJDwCHZjYgbFYDVTJHxXex9xt2XEGF8D356jBT1HtqNeucv3YsPLfTWcLcpFA',
      keyType: KeyType.Bls12381g2,
    })

    await expect(indyWallet.createKey({ seed, keyType: KeyType.Bls12381g1g2 })).rejects.toThrowError(WalletError)

    await expect(indyWallet.createKey({ seed, keyType: KeyType.X25519 })).rejects.toThrowError(WalletError)
  })

  test('Create a signature', async () => {
    const key = await indyWallet.createKey({ seed, keyType: KeyType.Bls12381g2 })
    const signature = await indyWallet.sign({
      data: message,
      key,
    })
    expect(signature.length).toEqual(BBS_SIGNATURE_LENGTH)
  })
})
