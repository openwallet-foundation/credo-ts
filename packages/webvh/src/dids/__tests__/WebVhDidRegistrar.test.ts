import {
  DidDocument,
  DidDocumentRole,
  DidDocumentService,
  DidRecord,
  DidRepository,
  InjectionSymbols,
} from '@credo-ts/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { InMemoryWallet } from '../../../../../tests/InMemoryWallet'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { mockResolvedDidDocument, mockResolvedDidRecord } from '../../anoncreds/services/__tests__/mock-resources'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'

const wallet = new InMemoryWallet()
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
      ],
      wallet,
    })
    await wallet.createAndOpen(agentConfig.walletConfig)
    repository = agentContext.dependencyManager.resolve(DidRepository)
  })

  afterEach(async () => {
    if (wallet.isInitialized) {
      await wallet.close()
    }
    await wallet.delete()
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

    it('should correctly create a new did webvh with path', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.test-suite.app', paths: ['credo', '01'] })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: expect.objectContaining({
          state: 'finished',
          didDocument: expect.any(Object),
        }),
      })

      expect(result.didState.did).toMatch(/:credo:01$/)
      expect(result.didState.didDocument?.context).toEqual([
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ])
      expect(result.didState.didDocument?.id).toMatch(/:credo:01$/)
      expect(result.didState.didDocument?.controller).toMatch(/:credo:01$/)

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
          reason: `DID not found`,
        },
      })
    })
  })
})
