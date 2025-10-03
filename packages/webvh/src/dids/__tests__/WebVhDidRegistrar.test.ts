import {
  CacheModuleConfig,
  DidDocument,
  DidDocumentRole,
  DidDocumentService,
  DidRecord,
  DidRepository,
  InMemoryLruCache,
  InjectionSymbols,
} from '@credo-ts/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { mockResolvedDidDocument, mockResolvedDidRecord } from '../../anoncreds/services/__tests__/mock-resources'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'

const inMemoryStorageService = new InMemoryStorageService()

describe('WebVhDidRegistrar Integration Tests', () => {
  let registrar: WebVhDidRegistrar
  let agentContext: ReturnType<typeof getAgentContext>
  let repository: DidRepository

  beforeEach(async () => {
    // Create a real resolver instance
    registrar = new WebVhDidRegistrar()

    // Create a fresh agent context
    const agentConfig = getAgentConfig('WebVhDidRegistrarTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, inMemoryStorageService],
        [
          CacheModuleConfig,
          new CacheModuleConfig({
            cache: new InMemoryLruCache({ limit: 500 }),
          }),
        ],
      ],
    })
    repository = agentContext.dependencyManager.resolve(DidRepository)
  })

  afterEach(() => {
    inMemoryStorageService.contextCorrelationIdToRecords = {}
  })

  describe('DID WebVH creation', () => {
    it('should correctly create a new did webvh', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.test-suite.app' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: expect.objectContaining({
          state: 'finished',
          didDocument: expect.any(Object),
        }),
      })

      expect(result.didState.did).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.context).toEqual([
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ])
      expect(result.didState.didDocument?.id).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.controller).toMatch(/^did:webvh:.+/)
      expect(result.didState.didDocument?.authentication?.[0]).toMatch(/^did:webvh:.+/)

      const authentication = result.didState.didDocument?.authentication?.[0]
      const verification = result.didState.didDocument?.verificationMethod?.[0]
      expect(verification?.id).toMatch(/^did:webvh:.+/)
      expect(verification?.controller).toMatch(/^did:webvh:.+/)
      expect(authentication).toEqual(verification?.id)
    })

    it('should correctly create two dids, each one with differents path and port', async () => {
      const didResult = await registrar.create(agentContext, { domain: 'id.test-suite.app:80', path: 'credo/01' })
      expect(didResult.didState.did).toMatch(/%3A80:credo:01$/)
      expect(didResult.didState.didDocument?.id).toMatch(/%3A80:credo:01$/)
      expect(didResult.didState.didDocument?.controller).toMatch(/%3A80:credo:01$/)

      const did2Result = await registrar.create(agentContext, { domain: 'id.test-suite.app:88', path: '/credo/02/' })
      expect(did2Result.didState.did).toMatch(/%3A88:credo:02$/)
      expect(did2Result.didState.didDocument?.id).toMatch(/%3A88:credo:02$/)
      expect(did2Result.didState.didDocument?.controller).toMatch(/%3A88:credo:02$/)
    })

    it('should correctly create a new did webvh with path and port', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.test-suite.app:80', path: 'credo/01' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: expect.objectContaining({
          state: 'finished',
          didDocument: expect.any(Object),
        }),
      })

      expect(result.didState.did).toMatch(/%3A80:credo:01$/)
      expect(result.didState.didDocument?.context).toEqual([
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ])
      expect(result.didState.didDocument?.id).toMatch(/%3A80:credo:01$/)
      expect(result.didState.didDocument?.controller).toMatch(/%3A80:credo:01$/)

      const authentication = result.didState.didDocument?.authentication?.[0]
      const verification = result.didState.didDocument?.verificationMethod?.[0]
      expect(authentication).toEqual(verification?.id)
    })

    it('should fail if DID record already exists', async () => {
      const domain = 'id.test-suite.app'
      const didRecord = new DidRecord({
        did: mockResolvedDidDocument.id,
        role: DidDocumentRole.Created,
      })
      didRecord.setTags({ domain })
      await repository.save(agentContext, didRecord)
      const result = await registrar.create(agentContext, { domain })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `A record with domain "${domain}" already exists.`,
        },
      })
    })
  })

  describe('DID WebVH update', () => {
    it('should correctly update a did webvh', async () => {
      const {
        didState: { did, didDocument },
      } = await registrar.create(agentContext, { domain: 'id.test-suite.app' })
      if (did && didDocument) {
        didDocument.service = mockResolvedDidDocument.service.map((service) => new DidDocumentService(service))
        const result = await registrar.update(agentContext, { did, didDocument })

        expect(result.didState.did).toMatch(did)
        expect(result.didState.didDocument?.context).toEqual([
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/multikey/v1',
        ])
        expect(result.didState.didDocument?.service).toEqual(didDocument.service)
      }
    })

    it('should fail if DID record not exists', async () => {
      const did = mockResolvedDidRecord.did
      const didDocument = new DidDocument(mockResolvedDidRecord.didDocument as unknown as DidDocument)

      const result = await registrar.update(agentContext, { did, didDocument })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'DID not found',
        },
      })
    })
  })
})
