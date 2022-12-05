import type { DIDDoc } from 'didcomm'

import {
  DidCommV2Service,
  DidDocument,
  DidDocumentService,
  DidResolverService,
  IndyAgentService,
  VerificationMethod,
} from '@aries-framework/core'

import { DidCommV2DidResolver } from '../src/services/DidCommV2DidResolver'

import { getAgentContext } from './helpers'

const didDocument = new DidDocument({
  id: 'did:example:alice',
  keyAgreement: ['did:example:alice#key-x25519'],
  verificationMethod: [
    new VerificationMethod({
      id: 'did:example:alice#key-x25519',
      type: 'X25519KeyAgreementKey2019',
      controller: 'did:example:alice',
      publicKeyBase58: '9hFgmPVfmBZwRvFEyniQDBkz9LmV7gDEqytWyGZLmDXE',
    }),
  ],
  service: [
    new DidDocumentService({
      id: 'did:example:alice#mediator',
      type: 'Mediator',
      serviceEndpoint: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
    }),
    new DidDocumentService({
      id: 'did:example:alice#endpoint',
      type: 'endpoint',
      serviceEndpoint: 'https://agent.com',
    }),
    new IndyAgentService({
      id: 'did:example:alice#indy-agent',
      serviceEndpoint: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      recipientKeys: ['did:sov:WJz9mHyW9BZksioQnRsrAo#key-agreement-1'],
      routingKeys: ['did:sov:mediator1#key-agreement-1', 'did:sov:mediator2#key-agreement-2'],
      priority: 5,
    }),
    new DidCommV2Service({
      id: 'did:example:alice#did-comm-v2',
      serviceEndpoint: 'https://agent.com/did-comm-v2',
      routingKeys: ['did:example:mediator1#key-x25519', 'did:example:mediator2#key-x25519'],
      accept: ['didcomm/v2', 'didcomm/aip2;env=rfc587'],
    }),
  ],
})

const resolveMock = jest.fn().mockResolvedValue({
  didResolutionMetadata: {},
  didDocument: didDocument,
  didDocumentMetadata: {},
})

jest.mock('@aries-framework/core', () => {
  const original = jest.requireActual('@aries-framework/core')
  return {
    __esModule: true,
    ...original,
    DidResolverService: jest.fn().mockImplementation(() => {
      return { resolve: resolveMock }
    }),
  }
})

const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

describe('DidCommV2DidResolver', () => {
  const agentContext = getAgentContext()
  const didResolverService = new DidResolverServiceMock()

  const didCommV2DidResolver = new DidCommV2DidResolver(agentContext, didResolverService)

  it('converts DidDocumentService of Mediator type into didcomm lib Service of Other kind', async () => {
    const result = await didCommV2DidResolver.resolve('did:example:alice')
    expect(result).not.toBeNull()

    const adaptedDidDocument = result as DIDDoc
    expect(adaptedDidDocument.services).toHaveLength(4)

    expect(adaptedDidDocument.services[0].id).toBe('did:example:alice#mediator')
    expect(adaptedDidDocument.services[0].kind).toStrictEqual({
      Other: {
        type: 'Mediator',
        serviceEndpoint: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
      },
    })
  })

  it('converts DidDocumentService of endpoint type into didcomm lib Service of Other kind', async () => {
    const result = await didCommV2DidResolver.resolve('did:example:alice')
    expect(result).not.toBeNull()

    const adaptedDidDocument = result as DIDDoc
    expect(adaptedDidDocument.services).toHaveLength(4)

    expect(adaptedDidDocument.services[1].id).toBe('did:example:alice#endpoint')
    expect(adaptedDidDocument.services[1].kind).toStrictEqual({
      Other: {
        type: 'endpoint',
        serviceEndpoint: 'https://agent.com',
      },
    })
  })

  it('converts IndyAgentService into didcomm lib Service of Other kind', async () => {
    const result = await didCommV2DidResolver.resolve('did:example:alice')
    expect(result).not.toBeNull()

    const adaptedDidDocument = result as DIDDoc
    expect(adaptedDidDocument.services).toHaveLength(4)

    expect(adaptedDidDocument.services[2].id).toBe('did:example:alice#indy-agent')
    expect(adaptedDidDocument.services[2].kind).toStrictEqual({
      Other: {
        type: 'IndyAgent',
        serviceEndpoint: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
        recipientKeys: ['did:sov:WJz9mHyW9BZksioQnRsrAo#key-agreement-1'],
        routingKeys: ['did:sov:mediator1#key-agreement-1', 'did:sov:mediator2#key-agreement-2'],
        priority: 5,
      },
    })
  })

  it('converts DidCommV2Service into didcomm lib Service of DIDCommMessaging kind', async () => {
    const result = await didCommV2DidResolver.resolve('did:example:alice')
    expect(result).not.toBeNull()

    const adaptedDidDocument = result as DIDDoc
    expect(adaptedDidDocument.services).toHaveLength(4)

    expect(adaptedDidDocument.services[3].id).toBe('did:example:alice#did-comm-v2')
    expect(adaptedDidDocument.services[3].kind).toStrictEqual({
      DIDCommMessaging: {
        service_endpoint: 'https://agent.com/did-comm-v2',
        accept: ['didcomm/v2', 'didcomm/aip2;env=rfc587'],
        routing_keys: ['did:example:mediator1#key-x25519', 'did:example:mediator2#key-x25519'],
      },
    })
  })
})
