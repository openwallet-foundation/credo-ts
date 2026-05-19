/**
 * Boundary contract tests for the WebVhDidRegistrar.
 *
 * These tests verify that the Credo WebVH integration layer remains behaviorally
 * aligned with the upstream `didwebvh-ts` library. Specifically:
 *
 * 1. The DID log produced by Credo's registrar conforms to the `DIDLogEntry`
 *    interface defined in `didwebvh-ts` — no reimplementation drift.
 * 2. Log state transitions (create → update) produce entries with monotonically
 *    increasing version indices and valid timestamps.
 * 3. A log produced by Credo's create/update operations can be resolved by the
 *    upstream `resolveDIDFromLog` function directly, proving structural parity.
 * 4. Resource URL parsing in the Credo resources module aligns with the URL
 *    format that `didwebvh-ts` produces when creating DIDs.
 */

import {
  CacheModuleConfig,
  DidDocumentService,
  DidRepository,
  InjectionSymbols,
  InMemoryLruCache,
} from '@credo-ts/core'
import { resolveDIDFromLog } from 'didwebvh-ts'
import { Subject } from 'rxjs'
import { vi } from 'vitest'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import type { WebVhDidLog, WebVhDidLogEntry } from '../../resources'
import { parseResourceId } from '../../resources'
import { WebVhDidCrypto } from '../WebVhDidCrypto'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'

// didwebvh-ts calls fetchWitnessProofs during resolve/update. In this offline unit-test
// environment those HTTP requests fail (ENOTFOUND) and generate stderr noise even when
// the operation succeeds. We stub global fetch to return an empty witness-proof list,
// which preserves behavior (witness proofs are optional here) while keeping output clean.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
)

const inMemoryStorageService = new InMemoryStorageService()

describe('WebVhDidRegistrar boundary contracts', () => {
  let registrar: WebVhDidRegistrar
  let agentContext: ReturnType<typeof getAgentContext>
  let repository: DidRepository

  beforeEach(() => {
    registrar = new WebVhDidRegistrar()
    const agentConfig = getAgentConfig('WebVhDidRegistrarBoundaryTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, inMemoryStorageService],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      ],
    })
    repository = agentContext.dependencyManager.resolve(DidRepository)
  })

  afterEach(() => {
    inMemoryStorageService.contextCorrelationIdToRecords = {}
  })

  describe('DID log shape conformance', () => {
    it('stores a valid WebVhDidLog in DidRecord metadata after create', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      expect(result.didState.state).toBe('finished')

      const did = result.didState.did
      if (!did) throw new Error('create failed')
      const record = await repository.findSingleByQuery(agentContext, { did })
      expect(record).toBeDefined()

      const log = record?.metadata.get('log') as WebVhDidLog
      expect(Array.isArray(log)).toBe(true)
      expect(log).toHaveLength(1)

      const entry: WebVhDidLogEntry = log[0]
      expect(typeof entry.versionId).toBe('string')
      expect(entry.versionId).toMatch(/^1-/)
      expect(typeof entry.versionTime).toBe('string')
      // ISO 8601 datetime
      expect(() => new Date(entry.versionTime).toISOString()).not.toThrow()
      expect(entry.parameters).toBeDefined()
      expect(typeof entry.parameters).toBe('object')
      expect(entry.state).toBeDefined()
      expect(entry.state.id).toBe(did)
    })

    it('each log entry has updateKeys in parameters after create', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const did = result.didState.did
      if (!did) throw new Error('create failed')
      const record = await repository.findSingleByQuery(agentContext, { did })
      const log = record?.metadata.get('log') as WebVhDidLog

      expect(Array.isArray(log[0].parameters.updateKeys)).toBe(true)
      expect(log[0].parameters.updateKeys?.length).toBeGreaterThan(0)
    })
  })

  describe('DID log state transitions', () => {
    it('log grows by one entry after update', async () => {
      const createResult = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      expect(createResult.didState.state).toBe('finished')
      const { did, didDocument } = createResult.didState
      if (!did || !didDocument) throw new Error('create failed')

      didDocument.service = [
        new DidDocumentService({ id: '#test', type: 'TestService', serviceEndpoint: 'https://example.com' }),
      ]
      const updateResult = await registrar.update(agentContext, { did, didDocument })
      expect(updateResult.didState.state).toBe('finished')

      const record = await repository.findSingleByQuery(agentContext, { did })
      const log = record?.metadata.get('log') as WebVhDidLog

      expect(log).toHaveLength(2)
    })

    it('version indices are monotonically increasing across log entries', async () => {
      const createResult = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const { did, didDocument } = createResult.didState
      if (!did || !didDocument) throw new Error('create failed')

      didDocument.service = [
        new DidDocumentService({ id: '#test', type: 'TestService', serviceEndpoint: 'https://example.com' }),
      ]
      await registrar.update(agentContext, { did, didDocument })

      const record = await repository.findSingleByQuery(agentContext, { did })
      const log = record?.metadata.get('log') as WebVhDidLog

      const indices = log.map((e) => parseInt(e.versionId.split('-')[0], 10))
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1])
      }
    })
  })

  describe('upstream resolveDIDFromLog round-trip', () => {
    it('a log produced by create can be resolved by the upstream resolveDIDFromLog', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      expect(result.didState.state).toBe('finished')
      const did = result.didState.did
      if (!did) throw new Error('create failed')

      const record = await repository.findSingleByQuery(agentContext, { did })
      const log = record?.metadata.get('log') as WebVhDidLog

      // Delegate directly to the upstream library — no Credo resolver involved.
      const verifier = new WebVhDidCrypto(agentContext)
      const resolved = await resolveDIDFromLog(log, { verifier })

      expect(resolved.did).toBe(did)
      expect(resolved.meta.error).toBeUndefined()
      expect(resolved.doc).toBeDefined()
      expect(resolved.doc.id).toBe(did)
    })

    it('a log produced by create+update can be resolved by the upstream resolveDIDFromLog', async () => {
      const createResult = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const { did, didDocument } = createResult.didState
      if (!did || !didDocument) throw new Error('create failed')

      didDocument.service = [
        new DidDocumentService({ id: '#test', type: 'TestService', serviceEndpoint: 'https://example.com' }),
      ]
      const updateResult = await registrar.update(agentContext, { did, didDocument })
      expect(updateResult.didState.state).toBe('finished')

      const record = await repository.findSingleByQuery(agentContext, { did })
      const log = record?.metadata.get('log') as WebVhDidLog

      const verifier = new WebVhDidCrypto(agentContext)
      const resolved = await resolveDIDFromLog(log, { verifier })

      expect(resolved.did).toBe(did)
      expect(resolved.meta.error).toBeUndefined()
      expect(resolved.doc.service).toBeDefined()
    })
  })

  describe('key fragment conformance', () => {
    it('stored didDocumentRelativeKeyId matches the actual fragment in the DID document verificationMethod', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      expect(result.didState.state).toBe('finished')
      const did = result.didState.did
      if (!did) throw new Error('create failed')

      const record = await repository.findSingleByQuery(agentContext, { did })
      expect(record?.keys).toBeDefined()
      expect(record?.keys?.length).toBeGreaterThan(0)

      const storedFragment = record?.keys?.[0].didDocumentRelativeKeyId
      if (!storedFragment) throw new Error('Missing didDocumentRelativeKeyId')

      // The stored fragment must start with '#' and must match the actual VM id
      // in the resolved DID document
      expect(storedFragment).toMatch(/^#/)

      const vmId = record?.didDocument?.verificationMethod?.[0]?.id
      if (!vmId) throw new Error('Missing verificationMethod id')
      expect(vmId.endsWith(storedFragment)).toBe(true)
    })

    it('didDocumentRelativeKeyId matches via endsWith semantics as used in Credo core', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const did = result.didState.did
      if (!did) throw new Error('create failed')

      const record = await repository.findSingleByQuery(agentContext, { did })
      const storedFragment = record?.keys?.[0].didDocumentRelativeKeyId
      if (!storedFragment) throw new Error('Missing didDocumentRelativeKeyId')
      const vmId = record?.didDocument?.verificationMethod?.[0]?.id
      if (!vmId) throw new Error('Missing verificationMethod id')

      // This mirrors the lookup logic used by Credo core (DidsApi line ~208) and the
      // corrected cryptosuite: verificationMethod.id.endsWith(didDocumentRelativeKeyId)
      expect(vmId.endsWith(storedFragment)).toBe(true)
    })
  })

  describe('resource URL parsing alignment', () => {
    it('parseResourceId correctly handles URLs in the format produced by didwebvh-ts DIDs', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const did = result.didState.did
      if (!did) throw new Error('create failed')

      // Simulate a resource URL derived from a real did:webvh DID
      const resourceId = `${did}/resources/zQmSomeFakeHash`
      const parsed = parseResourceId(resourceId)

      expect(parsed).not.toBeNull()
      expect(parsed?.did).toBe(did)
      expect(parsed?.resourceId).toBe('zQmSomeFakeHash')
    })

    it('parseResourceId rejects a plain DID without a resource path', async () => {
      const result = await registrar.create(agentContext, { domain: 'id.boundary-test.app' })
      const did = result.didState.did
      if (!did) throw new Error('create failed')

      expect(parseResourceId(did)).toBeNull()
    })
  })
})
