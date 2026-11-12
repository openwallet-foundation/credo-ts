import {
  CacheModuleConfig,
  DidDocumentService,
  DidRepository,
  InjectionSymbols,
  InMemoryLruCache,
} from '@credo-ts/core'
import * as webvh from 'didwebvh-ts'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { createWebVhTestOptions } from '../../../tests/utils'
import { WebVhApi } from '../../WebVhApi'
import { WebVhDidRegistrar } from '../WebVhDidRegistrar'
import { WebVhDidRecordMetadataKeys } from '../webVhDidRecordMetadataTypes'

vi.mock('didwebvh-ts', { spy: true })

describe('WebVhDidRegistrar adapter boundary', () => {
  let agentContext: ReturnType<typeof getAgentContext>
  const registrar = new WebVhDidRegistrar()

  beforeEach(() => {
    vi.clearAllMocks()
    agentContext = getAgentContext({
      agentConfig: getAgentConfig('WebVhDidBoundary'),
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, new InMemoryStorageService()],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      ],
    })
  })

  afterEach(() => vi.restoreAllMocks())

  test('passes authored create input and persists upstream results', async () => {
    const createDID = vi.spyOn(webvh, 'createDID')
    const options = await createWebVhTestOptions(agentContext)
    options.options.watchers = ['https://watcher.example']
    options.options.alsoKnownAsWeb = false
    const result = await registrar.create(agentContext, options)
    expect(result.didState.state).toBe('finished')
    expect(createDID).toHaveBeenCalledWith(
      expect.objectContaining({
        address: options.options.address,
        didDocument: options.didDocument.toJSON(),
        updateKeys: options.options.updateKeys,
        watchers: options.options.watchers,
        alsoKnownAsWeb: false,
        signer: expect.any(Object),
        verifier: expect.any(Object),
      })
    )
    expect(createDID.mock.calls[0][0]).not.toHaveProperty('keys')
    expect(createDID.mock.calls[0][0]).not.toHaveProperty('updateKeyKmsKeyIds')
    const returned = await createDID.mock.results[0].value
    const record = await agentContext.resolve(DidRepository).getSingleByQuery(agentContext, { did: returned.did })
    expect(record.metadata.get(WebVhDidRecordMetadataKeys.DidLog)).toEqual(returned.log)
    expect(result.didDocumentMetadata).toEqual(returned.meta)
  })

  test('update forwards the complete document, options and agent fetch without merging', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const created = await registrar.create(agentContext, options)
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const { did, didDocument } = created.didState
    didDocument.service = [new DidDocumentService({ id: '#new', type: 'Test', serviceEndpoint: 'https://example.com' })]
    didDocument.assertionMethod = undefined
    const updateDID = vi.spyOn(webvh, 'updateDID')
    const result = await registrar.update(agentContext, {
      did,
      didDocument,
      options: {
        watchers: ['https://watcher.example'],
        keys: options.options.keys,
        updateKeyKmsKeyIds: options.options.updateKeyKmsKeyIds,
      },
    })
    expect(result.didState.state).toBe('finished')
    expect(updateDID).toHaveBeenCalledWith(
      expect.objectContaining({
        didDocument: didDocument.toJSON(),
        watchers: ['https://watcher.example'],
        fetch: expect.any(Function),
      })
    )
    expect(updateDID.mock.calls[0][0]).not.toHaveProperty('keys')
    expect(updateDID.mock.calls[0][0]).not.toHaveProperty('updateKeyKmsKeyIds')
    expect(webvh.migrateDID).not.toHaveBeenCalled()
  })

  test('deactivate injects fetch and persists its returned log and metadata', async () => {
    const options = await createWebVhTestOptions(agentContext)
    const created = await registrar.create(agentContext, options)
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const deactivateDID = vi.spyOn(webvh, 'deactivateDID')
    const result = await registrar.deactivate(agentContext, { did: created.didState.did })
    expect(result.didState.state).toBe('finished')
    expect(deactivateDID).toHaveBeenCalledWith(expect.objectContaining({ fetch: expect.any(Function) }))
    const returned = await deactivateDID.mock.results[0].value
    const record = await agentContext.resolve(DidRepository).getSingleByQuery(agentContext, { did: returned.did })
    expect(record.metadata.get(WebVhDidRecordMetadataKeys.DidLog)).toEqual(returned.log)
    expect(result.didDocumentMetadata).toEqual(returned.meta)
  })

  test('migration uses the upstream migration writer and persists its returned identity and log', async () => {
    const options = await createWebVhTestOptions(agentContext)
    options.options.portable = true
    const created = await registrar.create(agentContext, options)
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const { did, didDocument } = created.didState
    const migrated = await registrar.update(agentContext, {
      did,
      didDocument,
      options: { address: 'xn--bcher-kva.example.com' },
    })
    if (migrated.didState.state !== 'finished') throw new Error('Fixture move failed')
    const migrationResult = await vi.mocked(webvh.updateDID).mock.results.at(-1)?.value
    const repository = agentContext.resolve(DidRepository)
    const record = await repository.getSingleByQuery(agentContext, { did: migrated.didState.did })
    const original = await vi.mocked(webvh.createDID).mock.results[0].value
    record.did = did
    record.didDocument = didDocument
    record.metadata.set(WebVhDidRecordMetadataKeys.DidLog, original.log)
    record.setTags({ domain: options.options.address })
    await repository.update(agentContext, record)
    const migrateDID = vi.spyOn(webvh, 'migrateDID').mockResolvedValue(migrationResult)
    vi.mocked(webvh.updateDID).mockClear()
    const result = await new WebVhApi(agentContext).migrate({
      did,
      didDocument,
      options: {
        address: 'b%C3%BCcher.example.com',
        keys: options.options.keys,
        updateKeyKmsKeyIds: options.options.updateKeyKmsKeyIds,
      },
    })
    expect(result.didState.state).toBe('finished')
    expect(webvh.updateDID).not.toHaveBeenCalled()
    expect(migrateDID).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'b%C3%BCcher.example.com', fetch: expect.any(Function) })
    )
    expect(migrateDID.mock.calls[0][0]).not.toHaveProperty('keys')
    expect(migrateDID.mock.calls[0][0]).not.toHaveProperty('updateKeyKmsKeyIds')
    const persisted = await repository.getSingleByQuery(agentContext, { did: migrationResult.did })
    expect(persisted.didDocument?.toJSON()).toEqual(migrationResult.doc)
    expect(persisted.metadata.get(WebVhDidRecordMetadataKeys.DidLog)).toEqual(migrationResult.log)
    expect(result.didDocumentMetadata).toEqual(migrationResult.meta)
    expect(
      await repository.getSingleByQuery(agentContext, {
        did: migrationResult.did,
        domain: 'xn--bcher-kva.example.com',
      })
    ).toMatchObject({ id: persisted.id })
  })

  test('retains thrown upstream detail and stringifies non-Error failures', async () => {
    const options = await createWebVhTestOptions(agentContext)
    vi.spyOn(webvh, 'createDID')
      .mockRejectedValueOnce(new Error('specific upstream validation detail'))
      .mockRejectedValueOnce(42)
    const first = await registrar.create(agentContext, options)
    expect(first.didState).toEqual({ state: 'failed', reason: 'unknownError: specific upstream validation detail' })
    const second = await registrar.create(agentContext, options)
    expect(second.didState).toEqual({ state: 'failed', reason: 'unknownError: 42' })
  })
})
