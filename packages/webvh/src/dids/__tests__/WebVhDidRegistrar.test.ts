import {
  CacheModuleConfig,
  DidDocumentService,
  DidRepository,
  InjectionSymbols,
  InMemoryLruCache,
} from '@credo-ts/core'
import {
  type DIDLog,
  type DIDResolutionMeta,
  deriveNextKeyHash,
  getWitnessRequirements,
  resolveDIDFromLog,
} from 'didwebvh-ts'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { createWebVhTestKey, createWebVhTestOptions } from '../../../tests/utils'
import { WebVhApi } from '../../WebVhApi'
import { WebVhDidCrypto } from '../WebVhDidCrypto'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'
import { WebVhDidRecordMetadataKeys } from '../webVhDidRecordMetadataTypes'

describe('WebVhDidRegistrar integration', () => {
  let registrar: WebVhDidRegistrar
  let agentContext: ReturnType<typeof getAgentContext>
  let repository: DidRepository

  beforeEach(() => {
    registrar = new WebVhDidRegistrar()
    agentContext = getAgentContext({
      agentConfig: getAgentConfig('WebVhDidRegistrarTest'),
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, new InMemoryStorageService()],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      ],
    })
    repository = agentContext.dependencyManager.resolve(DidRepository)
  })

  async function create(options?: Awaited<ReturnType<typeof createWebVhTestOptions>>) {
    const result = await registrar.create(agentContext, options ?? (await createWebVhTestOptions(agentContext)))
    expect(result.didState.state).toBe('finished')
    if (result.didState.state !== 'finished') throw new Error(`Create failed: ${JSON.stringify(result.didState)}`)
    return result.didState
  }

  test('persists the caller-authored fragment and returned log/document/metadata', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const { did, didDocument } = await create(options)
    const record = await repository.getSingleByQuery(agentContext, { did })
    expect(record.keys).toEqual(options.options.keys)
    expect(didDocument.verificationMethod?.[0].id).toBe(`${did}#assertion-key`)
    expect(didDocument.assertionMethod).toEqual([`${did}#assertion-key`])
    const log = record.metadata.get<DIDLog>(WebVhDidRecordMetadataKeys.DidLog)
    const resolved = await resolveDIDFromLog(log ?? [], { verifier: new WebVhDidCrypto(agentContext) })
    expect(resolved.didResolutionMetadata.error).toBeUndefined()
    expect(log?.[0].state).toEqual(didDocument.toJSON())
    expect(resolved.didDocument?.verificationMethod).toEqual(didDocument.toJSON().verificationMethod)
    expect(record.metadata.get<DIDResolutionMeta>(WebVhDidRecordMetadataKeys.ControllerMetadata)?.versionId).toBe(
      log?.[0].versionId
    )
  })

  test('uses a fully qualified host with port and caller-supplied path segments', async () => {
    const { did } = await create(await createWebVhTestOptions(agentContext, 'alice.example.com:8443', ['credo', '01']))
    expect(did).toMatch(/:alice\.example\.com%3A8443:credo:01$/)
    const record = await repository.getSingleByQuery(agentContext, { did })
    expect(record.getTag('domain')).toBe('alice.example.com:8443:credo:01')
  })

  test('preserves the existing domain duplicate-query behavior', async () => {
    await create()
    const result = await registrar.create(agentContext, await createWebVhTestOptions(agentContext))
    expect(result.didState).toEqual({
      state: 'failed',
      reason: 'unknownError: A record with domain "id.test-suite.app" already exists.',
    })
  })

  test('uses the returned location for duplicate queries when address forms differ', async () => {
    await create()
    const result = await registrar.create(
      agentContext,
      await createWebVhTestOptions(agentContext, 'https://id.test-suite.app/')
    )
    expect(result.didState).toMatchObject({ state: 'failed', reason: expect.stringContaining('already exists') })
    expect(await repository.getAll(agentContext)).toHaveLength(1)
  })

  test('allows controller keys outside the document and uncontrolled document methods', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const controller = await createWebVhTestKey(agentContext)
    options.options.keys = []
    options.options.updateKeys = [`did:key:${controller.multikey}#${controller.multikey}`]
    options.options.updateKeyKmsKeyIds = { [controller.multikey]: controller.keyId }
    const { did, didDocument } = await create(options)
    expect(didDocument.verificationMethod?.[0].publicKeyMultibase).not.toBe(controller.multikey)
    const result = await registrar.update(agentContext, { did, didDocument })
    expect(result.didState.state).toBe('finished')
    const record = await repository.getSingleByQuery(agentContext, { did })
    expect(record.keys).toEqual([])
    expect(record.metadata.get(WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds)).toEqual(
      options.options.updateKeyKmsKeyIds
    )
  })

  test('accepts an authored method embedded in assertionMethod', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const method = options.didDocument.verificationMethod?.[0]
    if (!method) throw new Error('Missing fixture method')
    options.didDocument.verificationMethod = []
    options.didDocument.authentication = []
    options.didDocument.assertionMethod = [method]
    const { did } = await create(options)
    expect((await repository.getSingleByQuery(agentContext, { did })).keys).toEqual(options.options.keys)
  })

  test('rejects a document key mapping with mismatched KMS public material', async () => {
    const options = await createWebVhTestOptions(agentContext)
    options.options.keys[0].kmsKeyId = (await createWebVhTestKey(agentContext)).keyId
    const result = await registrar.create(agentContext, options)
    expect(result.didState).toMatchObject({
      state: 'failed',
      reason: expect.stringContaining('does not match KMS key'),
    })
    expect(await repository.getAll(agentContext)).toHaveLength(0)
  })

  test('rejects a controller mapping with mismatched KMS public material', async () => {
    const options = await createWebVhTestOptions(agentContext)
    options.options.updateKeyKmsKeyIds[options.options.updateKeys[0]] = (await createWebVhTestKey(agentContext)).keyId
    const result = await registrar.create(agentContext, options)
    expect(result.didState).toMatchObject({
      state: 'failed',
      reason: expect.stringContaining('does not match KMS key'),
    })
  })

  test('maps typed missing KMS keys to notFound', async () => {
    const options = await createWebVhTestOptions(agentContext)
    options.options.keys[0].kmsKeyId = 'missing-key'
    const result = await registrar.create(agentContext, options)
    expect(result.didState).toMatchObject({ state: 'failed', reason: expect.stringMatching(/^notFound:/) })
  })

  test('replaces the complete document without repairing omitted relationships', async () => {
    const { did, didDocument } = await create()
    didDocument.assertionMethod = undefined
    didDocument.service = [
      new DidDocumentService({ id: '#test', type: 'Test', serviceEndpoint: 'https://example.com' }),
    ]
    const result = await registrar.update(agentContext, { did, didDocument })
    expect(result.didState.state).toBe('finished')
    expect(result.didState.didDocument?.assertionMethod).toBeUndefined()
    expect(result.didState.didDocument?.service).toEqual(didDocument.service)
  })

  test('rejects partial/add/remove document updates', async () => {
    const { did, didDocument } = await create()
    for (const didDocumentOperation of ['addToDidDocument', 'removeFromDidDocument'] as const) {
      const result = await registrar.update(agentContext, { did, didDocument, didDocumentOperation })
      expect(result.didState).toMatchObject({ state: 'failed', reason: expect.stringMatching(/^notSupported:/) })
    }
    // @ts-expect-error WebVH requires the complete DidDocument, unlike core's broader input.
    const result = await registrar.update(agentContext, { did, didDocument: { id: did } })
    expect(result.didState).toMatchObject({ state: 'failed', reason: expect.stringMatching(/^notSupported:/) })
    // @ts-expect-error Omitted documents are intentionally unsupported at the Credo boundary.
    const omitted = await registrar.update(agentContext, { did })
    expect(omitted.didState).toMatchObject({ state: 'failed', reason: expect.stringMatching(/^notSupported:/) })
  })

  test('drops stale document mappings but retains controller access', async () => {
    const { did, didDocument } = await create()
    const method = didDocument.verificationMethod?.[0]
    if (!method) throw new Error('Missing fixture method')
    method.id = `${did}#renamed`
    didDocument.authentication = [method.id]
    didDocument.assertionMethod = [method.id]
    const result = await registrar.update(agentContext, { did, didDocument })
    expect(result.didState.state).toBe('finished')
    const record = await repository.getSingleByQuery(agentContext, { did })
    expect(record.keys).toEqual([])
    expect(Object.keys(record.metadata.get(WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds) ?? {})).toHaveLength(1)
  })

  test('uses inherited controller keys after rotating and appending a parameter-only update', async () => {
    const { did, didDocument } = await create()
    const next = await createWebVhTestKey(agentContext)
    const rotated = await registrar.update(agentContext, {
      did,
      didDocument,
      options: { updateKeys: [next.multikey], updateKeyKmsKeyIds: { [next.multikey]: next.keyId } },
    })
    expect(rotated.didState.state).toBe('finished')
    const parameterUpdate = await registrar.update(agentContext, {
      did,
      didDocument,
      options: { watchers: ['https://watcher.example'] },
    })
    expect(parameterUpdate.didState.state).toBe('finished')
    const result = await registrar.update(agentContext, { did, didDocument })
    expect(result.didState.state).toBe('finished')
    const record = await repository.getSingleByQuery(agentContext, { did })
    const log = record.metadata.get<DIDLog>(WebVhDidRecordMetadataKeys.DidLog)
    expect(log?.at(-1)?.proof?.[0].verificationMethod).toBe(`did:key:${next.multikey}#${next.multikey}`)
  })

  test('signs pre-rotation with the committed replacement key, then deactivates separately', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const next = await createWebVhTestKey(agentContext)
    options.options.nextKeyHashes = [await deriveNextKeyHash(next.multikey)]
    const { did, didDocument } = await create(options)
    const premature = await registrar.deactivate(agentContext, { did })
    expect(premature.didState).toMatchObject({
      state: 'failed',
      reason: expect.stringContaining('pre-rotation is active'),
    })

    const update = await registrar.update(agentContext, {
      did,
      didDocument,
      options: { updateKeys: [next.multikey], nextKeyHashes: [], updateKeyKmsKeyIds: { [next.multikey]: next.keyId } },
    })
    expect(update.didState.state).toBe('finished')
    const deactivated = await registrar.deactivate(agentContext, { did })
    expect(deactivated.didState.state).toBe('finished')
    expect(deactivated.didDocumentMetadata.deactivated).toBe(true)
    const record = await repository.getSingleByQuery(agentContext, { did })
    expect(record.metadata.get(WebVhDidRecordMetadataKeys.DidLog)).toHaveLength(3)
    expect(record.metadata.get<DIDResolutionMeta>(WebVhDidRecordMetadataKeys.ControllerMetadata)?.updateKeys).toEqual(
      []
    )
  })

  test('bridges a witnessed create and update with application-collected proofs, without witness requests', async () => {
    const fetch = vi.spyOn(agentContext.config, 'fetch')
    const witness = await createWebVhTestKey(agentContext)
    const options = await createWebVhTestOptions(agentContext)
    options.options.witness = { threshold: 1, witnesses: [{ id: `did:key:${witness.multikey}` }] }
    const { did, didDocument } = await create(options)
    const api = new WebVhApi(agentContext)
    const genesis = await api.getPublicationData(did)
    const genesisProof = await api.signWitnessProof({
      trustedLog: [],
      candidateLog: genesis.log,
      witnessProofs: [],
      kmsKeyId: witness.keyId,
    })
    await api.storeWitnessProofs(did, [genesisProof])
    const update = await registrar.update(agentContext, { did, didDocument })
    expect(update.didState.state).toBe('finished')
    const candidate = await api.getPublicationData(did)
    const updateProof = await api.signWitnessProof({
      trustedLog: genesis.log,
      candidateLog: candidate.log,
      witnessProofs: [genesisProof],
      kmsKeyId: witness.keyId,
    })
    await api.storeWitnessProofs(did, [genesisProof, updateProof])
    expect(getWitnessRequirements(candidate.log).map((requirement) => requirement.threshold)).toEqual([1, 1])
    expect(await api.verifyWitnessProofs({ log: candidate.log, witnessProofs: [genesisProof] })).toMatchObject({
      verified: false,
      requirements: [{ satisfied: true }, { satisfied: false }],
    })
    expect(
      await api.verifyWitnessProofs({ log: candidate.log, witnessProofs: [genesisProof, updateProof] })
    ).toMatchObject({
      verified: true,
      requirements: [
        { satisfied: true, approvals: 1 },
        { satisfied: true, approvals: 1 },
      ],
      rejectedProofs: [expect.objectContaining({ code: 'duplicate-witness' })],
    })
    const resolved = await api.resolveDIDFromLog(candidate.log, { witnessProofs: [genesisProof, updateProof] })
    expect(resolved.didResolutionMetadata.error).toBeUndefined()
    expect(resolved.didDocumentMetadata.witness.threshold).toBe('1')
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })

  test('persists returned DID and document when moving a portable DID', async () => {
    const options = await createWebVhTestOptions(agentContext)
    options.options.portable = true
    const { did, didDocument } = await create(options)
    const result = await registrar.update(agentContext, { did, didDocument, options: { address: 'moved.example.com' } })
    expect(result.didState.state).toBe('finished')
    expect(result.didState.did).toMatch(/:moved\.example\.com$/)
    const record = await repository.getSingleByQuery(agentContext, { did: result.didState.did })
    expect(record.didDocument?.id).toBe(result.didState.did)
    expect(await repository.findSingleByQuery(agentContext, { did })).toBeNull()
  })

  test('missing records and missing controller mappings remain distinct failures', async () => {
    const { did, didDocument } = await create()
    const missing = await registrar.update(agentContext, { did: `${did}:absent`, didDocument })
    expect(missing.didState).toMatchObject({ state: 'failed', reason: expect.stringMatching(/^notFound:/) })
    const record = await repository.getSingleByQuery(agentContext, { did })
    record.metadata.set(WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds, {})
    await repository.update(agentContext, record)
    const inconsistent = await registrar.update(agentContext, { did, didDocument })
    expect(inconsistent.didState).toMatchObject({
      state: 'failed',
      reason: expect.stringContaining('unknownError: no authorized controller'),
    })
  })
})
