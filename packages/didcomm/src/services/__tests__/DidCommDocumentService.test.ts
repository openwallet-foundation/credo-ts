import type { AgentContext, VerificationMethod } from '@credo-ts/core'
import {
  DidCommV1Service,
  DidDocument,
  DidRepository,
  DidResolverService,
  IndyAgentService,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  TypedArrayEncoder,
  verkeyToPublicJwk,
} from '@credo-ts/core'
import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { DidCommDocumentService } from '../DidCommDocumentService'

vi.mock('../../../../core/src/modules/dids/services/DidResolverService')
const DidResolverServiceMock = DidResolverService as MockedClassConstructor<typeof DidResolverService>

vi.mock('../../../../core/src/modules/dids/services/DidResolverService')
const DidRepositoryMock = DidRepository as MockedClassConstructor<typeof DidRepository>

describe('DidCommDocumentService', () => {
  let didCommDocumentService: DidCommDocumentService
  let didResolverService: DidResolverService
  let didRepository: DidRepository
  let agentContext: AgentContext

  beforeEach(async () => {
    didResolverService = new DidResolverServiceMock()
    didRepository = new DidRepositoryMock()
    didCommDocumentService = new DidCommDocumentService(didResolverService, didRepository)
    agentContext = getAgentContext()
  })

  describe('resolveServicesFromDid', () => {
    test('throw error when resolveDidDocument fails', async () => {
      const error = new Error('test')
      mockFunction(didResolverService.resolveDidDocument).mockRejectedValue(error)

      await expect(didCommDocumentService.resolveServicesFromDid(agentContext, 'did')).rejects.toThrow(error)
    })

    test('resolves IndyAgentService', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
          service: [
            new IndyAgentService({
              id: 'test-id',
              serviceEndpoint: 'https://test.com',
              recipientKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
              routingKeys: ['DADEajsDSaksLng9h'],
              priority: 5,
            }),
          ],
        })
      )

      const resolved = await didCommDocumentService.resolveServicesFromDid(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h'
      )
      expect(didResolverService.resolveDidDocument).toHaveBeenCalledWith(agentContext, 'did:sov:Q4zqM7aXqm7gDQkUVLng9h')

      expect(resolved).toHaveLength(1)
      expect(resolved[0]).toMatchObject({
        id: 'test-id',
        serviceEndpoint: 'https://test.com',
        recipientKeys: [verkeyToPublicJwk('Q4zqM7aXqm7gDQkUVLng9h')],
        routingKeys: [verkeyToPublicJwk('DADEajsDSaksLng9h')],
      })
    })

    test('resolves DidCommV1Service', async () => {
      const publicKeyBase58Ed25519 = 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8'
      const publicKeyBase58X25519 = 'S3AQEEKkGYrrszT9D55ozVVX2XixYp8uynqVm4okbud'

      const Ed25519VerificationMethod: VerificationMethod = {
        type: 'Ed25519VerificationKey2018',
        controller: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#key-1',
        publicKeyBase58: publicKeyBase58Ed25519,
      }
      const X25519VerificationMethod: VerificationMethod = {
        type: 'X25519KeyAgreementKey2019',
        controller: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#key-agreement-1',
        publicKeyBase58: publicKeyBase58X25519,
      }

      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
          verificationMethod: [Ed25519VerificationMethod, X25519VerificationMethod],
          authentication: [Ed25519VerificationMethod.id],
          keyAgreement: [X25519VerificationMethod.id],
          service: [
            new DidCommV1Service({
              id: 'test-id',
              serviceEndpoint: 'https://test.com',
              recipientKeys: [X25519VerificationMethod.id],
              routingKeys: [Ed25519VerificationMethod.id],
              priority: 5,
            }),
          ],
        })
      )

      const resolved = await didCommDocumentService.resolveServicesFromDid(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h'
      )
      expect(didResolverService.resolveDidDocument).toHaveBeenCalledWith(agentContext, 'did:sov:Q4zqM7aXqm7gDQkUVLng9h')

      const ed25519Key = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58(publicKeyBase58Ed25519),
      })
      expect(resolved).toHaveLength(1)
      expect(resolved[0].id).toEqual('test-id')
      expect(resolved[0].serviceEndpoint).toEqual('https://test.com')
      expect(resolved[0].recipientKeys[0].equals(ed25519Key)).toBe(true)
      expect(resolved[0].routingKeys[0].equals(ed25519Key)).toBe(true)
    })

    test('resolves specific DidCommV1Service', async () => {
      const publicKeyBase58Ed25519 = 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8'
      const publicKeyBase58X25519 = 'S3AQEEKkGYrrszT9D55ozVVX2XixYp8uynqVm4okbud'

      const Ed25519VerificationMethod: VerificationMethod = {
        type: 'Ed25519VerificationKey2018',
        controller: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#key-1',
        publicKeyBase58: publicKeyBase58Ed25519,
      }
      const X25519VerificationMethod: VerificationMethod = {
        type: 'X25519KeyAgreementKey2019',
        controller: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#key-agreement-1',
        publicKeyBase58: publicKeyBase58X25519,
      }

      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
          verificationMethod: [Ed25519VerificationMethod, X25519VerificationMethod],
          authentication: [Ed25519VerificationMethod.id],
          keyAgreement: [X25519VerificationMethod.id],
          service: [
            new DidCommV1Service({
              id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id',
              serviceEndpoint: 'https://test.com',
              recipientKeys: [X25519VerificationMethod.id],
              routingKeys: [Ed25519VerificationMethod.id],
              priority: 5,
            }),
            new DidCommV1Service({
              id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id-2',
              serviceEndpoint: 'wss://test.com',
              recipientKeys: [X25519VerificationMethod.id],
              routingKeys: [Ed25519VerificationMethod.id],
              priority: 6,
            }),
          ],
        })
      )

      let resolved = await didCommDocumentService.resolveServicesFromDid(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id'
      )
      expect(didResolverService.resolveDidDocument).toHaveBeenCalledWith(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id'
      )

      expect(resolved).toHaveLength(1)
      const ed25519Key = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58(publicKeyBase58Ed25519),
      })
      expect(resolved).toHaveLength(1)
      expect(resolved[0].id).toEqual('did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id')
      expect(resolved[0].serviceEndpoint).toEqual('https://test.com')
      expect(resolved[0].recipientKeys[0].equals(ed25519Key)).toBe(true)
      expect(resolved[0].routingKeys[0].equals(ed25519Key)).toBe(true)

      resolved = await didCommDocumentService.resolveServicesFromDid(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id-2'
      )
      expect(didResolverService.resolveDidDocument).toHaveBeenCalledWith(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id-2'
      )

      expect(resolved[0].id).toEqual('did:sov:Q4zqM7aXqm7gDQkUVLng9h#test-id-2')
      expect(resolved[0].serviceEndpoint).toEqual('wss://test.com')
      expect(resolved[0].recipientKeys[0].equals(ed25519Key)).toBe(true)
      expect(resolved[0].routingKeys[0].equals(ed25519Key)).toBe(true)
      expect(resolved).toHaveLength(1)
    })

    test('resolves NewDidCommV2Service routingKeys for mediation (DIDCommMessaging endpoint)', async () => {
      const publicKeyBase58Ed25519 = 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8'
      const publicKeyBase58X25519 = 'S3AQEEKkGYrrszT9D55ozVVX2XixYp8uynqVm4okbud'

      const Ed25519VerificationMethod: VerificationMethod = {
        type: 'Ed25519VerificationKey2018',
        controller: 'did:example:mobile',
        id: 'did:example:mobile#key-1',
        publicKeyBase58: publicKeyBase58Ed25519,
      }
      const X25519VerificationMethod: VerificationMethod = {
        type: 'X25519KeyAgreementKey2019',
        controller: 'did:example:mobile',
        id: 'did:example:mobile#key-agreement-1',
        publicKeyBase58: publicKeyBase58X25519,
      }

      const holderDoc = new DidDocument({
        context: [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: 'did:example:mobile',
        verificationMethod: [Ed25519VerificationMethod, X25519VerificationMethod],
        authentication: [Ed25519VerificationMethod.id],
        keyAgreement: [X25519VerificationMethod.id],
        service: [
          new NewDidCommV2Service({
            id: 'did:example:mobile#dm',
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              uri: 'wss://mediator.example/didcomm',
              accept: ['didcomm/v2'],
              routingKeys: [Ed25519VerificationMethod.id],
            }),
          }),
        ],
      })

      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(holderDoc)

      const resolved = await didCommDocumentService.resolveServicesFromDid(agentContext, 'did:example:mobile')
      expect(resolved).toHaveLength(1)
      expect(resolved[0].serviceEndpoint).toEqual('wss://mediator.example/didcomm')
      expect(resolved[0].routingKeys).toHaveLength(1)
      const ed25519Key = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58(publicKeyBase58Ed25519),
      })
      expect(resolved[0].routingKeys[0].equals(ed25519Key)).toBe(true)
    })
  })

  describe('getSupportedDidCommVersionsFromDidDoc', () => {
    test('v1 when only IndyAgent is present', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
          service: [
            new IndyAgentService({
              id: 'test-id',
              serviceEndpoint: 'https://test.com',
              recipientKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
              routingKeys: [],
              priority: 5,
            }),
          ],
        })
      )
      const result = await didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(
        agentContext,
        'did:sov:Q4zqM7aXqm7gDQkUVLng9h'
      )
      expect(result.versions).toEqual(['v1'])
    })

    test('v2 when only DIDCommMessaging is present', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:example:holder',
          service: [
            new NewDidCommV2Service({
              id: 'did:example:holder#dm',
              serviceEndpoint: new NewDidCommV2ServiceEndpoint({
                uri: 'https://example.com',
                accept: ['didcomm/v2'],
              }),
            }),
          ],
        })
      )
      const result = await didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(
        agentContext,
        'did:example:holder'
      )
      expect(result.versions).toEqual(['v2'])
    })

    test('both v1 and v2 when dual-stack DID', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:example:both',
          service: [
            new DidCommV1Service({
              id: 'did:example:both#v1',
              serviceEndpoint: 'https://v1.example',
              recipientKeys: ['did:example:both#key-1'],
            }),
            new NewDidCommV2Service({
              id: 'did:example:both#v2',
              serviceEndpoint: new NewDidCommV2ServiceEndpoint({
                uri: 'https://v2.example',
                accept: ['didcomm/v2'],
              }),
            }),
          ],
        })
      )
      const result = await didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(
        agentContext,
        'did:example:both'
      )
      expect(result.versions).toContain('v1')
      expect(result.versions).toContain('v2')
      expect(result.versions).toHaveLength(2)
    })

    test('throws when no DIDComm services are present', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:example:none',
          service: [],
        })
      )
      await expect(
        didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(agentContext, 'did:example:none')
      ).rejects.toThrow(/No DIDComm-compatible services found/)
    })

    test('throws when fragment references non-existent service', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:example:frag',
          service: [
            new DidCommV1Service({
              id: 'did:example:frag#v1',
              serviceEndpoint: 'https://v1.example',
              recipientKeys: ['did:example:frag#key-1'],
            }),
          ],
        })
      )
      await expect(
        didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(agentContext, 'did:example:frag#v2')
      ).rejects.toThrow(/No DIDComm service found for DID URL/)
    })

    test('v2 only when fragment selects v2 service', async () => {
      mockFunction(didResolverService.resolveDidDocument).mockResolvedValue(
        new DidDocument({
          context: ['https://w3id.org/did/v1'],
          id: 'did:example:frag',
          service: [
            new DidCommV1Service({
              id: 'did:example:frag#v1',
              serviceEndpoint: 'https://v1.example',
              recipientKeys: ['did:example:frag#key-1'],
            }),
            new NewDidCommV2Service({
              id: 'did:example:frag#v2',
              serviceEndpoint: new NewDidCommV2ServiceEndpoint({
                uri: 'https://v2.example',
                accept: ['didcomm/v2'],
              }),
            }),
          ],
        })
      )
      const result = await didCommDocumentService.getSupportedDidCommVersionsFromDidDoc(
        agentContext,
        'did:example:frag#v2'
      )
      expect(result.versions).toEqual(['v2'])
    })
  })
})
