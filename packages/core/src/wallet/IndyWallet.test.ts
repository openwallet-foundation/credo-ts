import { getAgentConfig, getBaseConfig } from '../../tests/helpers'
import { Agent } from '../agent/Agent'
import { KeyType } from '../crypto'

import { IndyWallet } from './IndyWallet'
import { WalletError } from './error'

describe('IndyWallet', () => {
  let indyWallet: IndyWallet
  let agent: Agent

  beforeEach(async () => {
    const { config, agentDependencies } = getBaseConfig('IndyWalletTest')
    const agent = new Agent(config, agentDependencies)
    indyWallet = agent.injectionContainer.resolve(IndyWallet)
    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('Initializes a public did', async () => {
    await indyWallet.initPublicDid({ seed: '00000000000000000000000Forward01' })

    expect(indyWallet.publicDid).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  test('Create every keypair', async () => {
    expect(indyWallet.createKey({ keyType: KeyType.Ed25519 })).resolves.toMatchObject({ keyType: KeyType.Ed25519 })

    expect(indyWallet.createKey({ keyType: KeyType.Bls12381g1 })).resolves.toMatchObject({
      keyType: KeyType.Bls12381g1,
    })

    expect(indyWallet.createKey({ keyType: KeyType.Bls12381g2 })).resolves.toMatchObject({
      keyType: KeyType.Bls12381g2,
    })

    expect(indyWallet.createKey({ keyType: KeyType.Bls12381g1g2 })).rejects.toThrowError(WalletError)

    expect(indyWallet.createKey({ keyType: KeyType.X25519 })).rejects.toThrowError(WalletError)
  })
})
