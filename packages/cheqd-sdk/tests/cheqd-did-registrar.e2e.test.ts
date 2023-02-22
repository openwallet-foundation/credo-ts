import type { CheqdDidCreateOptions } from '../src/dids'

import { Agent, TypedArrayEncoder } from '@aries-framework/core'
import { CheqdNetwork, MethodSpecificIdAlgo, VerificationMethods } from '@cheqd/sdk'

import { getAgentOptions } from '../../core/tests/helpers'

import { getCheqdSdkModules } from './setupCheqdSdkModule'

const agentOptions = getAgentOptions('Faber Dids Registrar', {}, getCheqdSdkModules())

describe('Cheqd DID registrar', () => {
  let agent: Agent<ReturnType<typeof getCheqdSdkModules>>

  beforeAll(async () => {
    agent = new Agent(agentOptions)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a did:cheqd did', async () => {
    // Generate a seed and the cheqd did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
        .slice(0, 32)
    )
    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      secret: {
        verificationMethod: {
          id: 'key-1',
          type: VerificationMethods.Ed255192018,
          privateKey,
        },
      },
      options: {
        network: CheqdNetwork.Testnet,
        methodSpecificIdAlgo: MethodSpecificIdAlgo.Uuid,
      },
    })
    expect(did.didState).toMatchObject({ state: 'finished' })
  })
})
