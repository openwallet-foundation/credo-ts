import { Agent, JsonTransformer } from '@aries-framework/core'

import { getAgentOptions } from '../../core/tests/helpers'

import { getCheqdModules } from './setupCheqdModule'

const agent = new Agent(getAgentOptions('Indy SDK Sov DID resolver', {}, getCheqdModules()))

describe('Cheqd DID resolver', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should resolve a did:cheqd:testnet did', async () => {
    const did = await agent.dids.resolve('did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8')
    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
        id: 'did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8',
        controller: ['did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8'],
        verificationMethod: [
          {
            controller: 'did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8',
            id: 'did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8#key-1',
            publicKeyMultibase: 'z6MksPpyxgw5aFymMboa81CQ7h1kJJ9yehNzPgo714y1HrAA',
            type: 'Ed25519VerificationKey2020',
          },
        ],
        authentication: ['did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8#key-1'],
      },
      didDocumentMetadata: {
        created: '2022-10-17T13:42:37.000Z',
        updated: '0001-01-01T00:00:00.000Z',
        deactivated: false,
        versionId: '7314e3e5-f9cc-50e9-b249-348963937c96',
        nextVersionId: '',
      },
      didResolutionMetadata: {},
    })
  })
})
