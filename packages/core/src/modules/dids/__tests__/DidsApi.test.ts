import { IndySdkModule } from '../../../../../indy-sdk/src'
import { indySdk } from '../../../../tests'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'

import { DidDocument, IndyAgentService } from '@aries-framework/core'

const agentOptions = getAgentOptions(
  'DidsApi',
  {},
  {
    indySdk: new IndySdkModule({
      indySdk,
    }),
  }
)

const agent = new Agent(agentOptions)

describe('DidsApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('store an existing did document', async () => {
    expect(await agent.dids.getCreatedDids()).toHaveLength(0)

    await agent.dids.storeCreatedDid({
      didDocument: new DidDocument({
        id: 'did:example:123',
        service: [
          new IndyAgentService({
            id: 'did:example:123#didcomm',
            recipientKeys: ['verkey'],
            serviceEndpoint: 'https:/didcomm.org',
          }),
        ],
      }),
    })

    const createdDids = await agent.dids.getCreatedDids()
    expect(createdDids).toHaveLength(1)

    expect(createdDids[0].getTags()).toEqual({
      did: 'did:example:123',
      legacyUnqualifiedDid: undefined,
      method: 'example',
      methodSpecificIdentifier: '123',
      recipientKeyFingerprints: ['z9yvQ5XjSY5'],
      role: 'created',
    })

    expect(createdDids[0].toJSON()).toMatchObject({
      did: 'did:example:123',
      didDocument: {
        id: 'did:example:123',
        service: [
          {
            id: 'did:example:123#didcomm',
            recipientKeys: ['verkey'],
            serviceEndpoint: 'https:/didcomm.org',
          },
        ],
      },
    })
  })
})
