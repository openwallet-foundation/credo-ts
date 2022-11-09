import type { AgentContext } from '../../../../agent'
import type { VerificationMethod } from '../../../dids'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { Key, KeyType } from '../../../../crypto'
import { DidCommV1Service, DidDocument, IndyAgentService } from '../../../dids'
import { verkeyToInstanceOfKey } from '../../../dids/helpers'
import { DidResolverService } from '../../../dids/services/DidResolverService'
import { DidCommDocumentService } from '../DidCommDocumentService'

jest.mock('../../../dids/services/DidResolverService')
const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

describe('DidCommDocumentService', () => {
  const agentConfig = getAgentConfig('DidCommDocumentService')
  let didCommDocumentService: DidCommDocumentService
  let didResolverService: DidResolverService
  let agentContext: AgentContext

  beforeEach(async () => {
    didResolverService = new DidResolverServiceMock()
    didCommDocumentService = new DidCommDocumentService(agentConfig, didResolverService)
    agentContext = getAgentContext()
  })

  describe('resolveServicesFromDid', () => {
    test('throw error when resolveDidDocument fails', async () => {
      const error = new Error('test')
      mockFunction(didResolverService.resolveDidDocument).mockRejectedValue(error)

      await expect(didCommDocumentService.resolveServicesFromDid(agentContext, 'did')).rejects.toThrowError(error)
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
        recipientKeys: [verkeyToInstanceOfKey('Q4zqM7aXqm7gDQkUVLng9h')],
        routingKeys: [verkeyToInstanceOfKey('DADEajsDSaksLng9h')],
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

      const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58Ed25519, KeyType.Ed25519)
      expect(resolved).toHaveLength(1)
      expect(resolved[0]).toMatchObject({
        id: 'test-id',
        serviceEndpoint: 'https://test.com',
        recipientKeys: [ed25519Key],
        routingKeys: [ed25519Key],
      })
    })
  })
})
