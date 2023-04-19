import { Agent, JsonTransformer } from '@aries-framework/core'

import { getAgentOptions } from '../../core/tests/helpers'
import { getClosestResourceVersion } from '../src/dids/didCheqdUtil'
import { DefaultRPCUrl } from '../src/ledger/CheqdLedgerService'

import { getCheqdModules } from './setupCheqdModule'

export const resolverAgent = new Agent(
  getAgentOptions('Cheqd resolver', {}, getCheqdModules(undefined, DefaultRPCUrl.Testnet))
)

describe('Cheqd DID resolver', () => {
  beforeAll(async () => {
    await resolverAgent.initialize()
  })

  afterAll(async () => {
    await resolverAgent.shutdown()
    await resolverAgent.wallet.delete()
  })

  it('should resolve a did:cheqd:testnet did', async () => {
    const did = await resolverAgent.dids.resolve('did:cheqd:testnet:3053e034-8faa-458d-9f01-2e3e1e8b2ab8')
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

  it('should getClosestResourceVersion', async () => {
    const did = await resolverAgent.dids.resolve('did:cheqd:testnet:SiVQgrFZ7jFZFrTGstT4ZD')
    let resource = getClosestResourceVersion(did.didDocumentMetadata.linkedResourceMetadata, new Date())
    expect(resource).toMatchObject({
      id: '0b02ebf4-07c4-4df7-9015-e93c21108240',
    })
    resource = getClosestResourceVersion(
      did.didDocumentMetadata.linkedResourceMetadata,
      new Date('2022-11-16T10:56:34Z')
    )
    expect(resource).toMatchObject({
      id: '8140ec3a-d8bb-4f59-9784-a1cbf91a4a35',
    })
    resource = getClosestResourceVersion(
      did.didDocumentMetadata.linkedResourceMetadata,
      new Date('2022-11-16T11:41:48Z')
    )
    expect(resource).toMatchObject({
      id: 'a20aa56a-a76f-4828-8a98-4c85d9494545',
    })
  })
})
