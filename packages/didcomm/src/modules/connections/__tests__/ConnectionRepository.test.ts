import {
  Agent,
  CachedStorageService,
  CacheModule,
  CacheModuleConfig,
  InjectionSymbols,
  RecordDuplicateError,
  SingleContextStorageLruCache,
  type StorageService,
} from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { agentDependencies, getAgentContext, getAgentOptions } from '../../../../../core/tests'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from '../models'
import { DidCommConnectionRecord, DidCommConnectionRepository } from '../repository'

const cache = new SingleContextStorageLruCache({ limit: 500 })
const cacheSetSpy = vi.spyOn(cache, 'set')
const cacheGetSpy = vi.spyOn(cache, 'get')

const agentOptions = getAgentOptions(
  'Agent Connection Repository',
  {},
  {},
  {
    cache: new CacheModule({ useCachedStorageService: true, cache }),
  },
  { requireDidcomm: true }
)

describe('ConnectionRepository', () => {
  const agent = new Agent(agentOptions)

  beforeAll(async () => {
    await agent.initialize()
  })

  describe('ConnectionRepository DID lookups', () => {
    const context = getAgentContext({
      registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache })]],
    })
    const dids = { ourDid: 'did:example:ours', theirDid: 'did:example:theirs' }
    let repository: DidCommConnectionRepository

    beforeEach(() => {
      repository = new DidCommConnectionRepository(
        new InMemoryStorageService<DidCommConnectionRecord>(),
        new EventEmitter(agentDependencies, new Subject())
      )
    })

    test.each([
      { did: dids.ourDid, theirDid: dids.theirDid },
      { did: dids.ourDid, previousTheirDids: [dids.theirDid] },
      { previousDids: [dids.ourDid], theirDid: dids.theirDid },
      {
        did: dids.ourDid,
        theirDid: dids.theirDid,
        previousDids: [dids.ourDid],
        previousTheirDids: [dids.theirDid],
      },
    ])('finds current and rotated DIDs and deduplicates overlapping clauses: %j', async (props) => {
      const record = new DidCommConnectionRecord({
        role: DidCommDidExchangeRole.Requester,
        state: DidCommDidExchangeState.Start,
        ...props,
      })
      await repository.save(context, record)
      const query = vi.spyOn(repository, 'findByQuery')
      expect(await repository.findByDids(context, dids)).toMatchObject({ id: record.id })
      expect(query.mock.calls).toEqual([
        [context, { did: dids.ourDid, theirDid: dids.theirDid }],
        [context, { did: dids.ourDid, previousTheirDids: [dids.theirDid] }],
        [context, { previousDids: [dids.ourDid], theirDid: dids.theirDid }],
      ])
    })

    test('returns null when no connection matches', async () => {
      expect(await repository.findByDids(context, dids)).toBeNull()
    })

    test('throws for distinct records matching different clauses', async () => {
      for (const props of [
        { did: dids.ourDid, theirDid: dids.theirDid },
        { did: dids.ourDid, previousTheirDids: [dids.theirDid] },
      ]) {
        await repository.save(
          context,
          new DidCommConnectionRecord({
            role: DidCommDidExchangeRole.Requester,
            state: DidCommDidExchangeState.Start,
            ...props,
          })
        )
      }
      await expect(repository.findByDids(context, dids)).rejects.toThrow(RecordDuplicateError)
    })

    test('runs queries sequentially and propagates storage errors', async () => {
      const query = vi.spyOn(repository, 'findByQuery').mockImplementationOnce(async () => {
        await Promise.resolve()
        expect(query).toHaveBeenCalledTimes(1)
        throw new Error('storage unavailable')
      })
      await expect(repository.findByDids(context, dids)).rejects.toThrow('storage unavailable')
      expect(query).toHaveBeenCalledTimes(1)
    })
  })

  test('check that caching is setup correctly', () => {
    const css = agent.context.resolve(CachedStorageService)
    expect(css).toBeInstanceOf(CachedStorageService)
  })

  test('check if cache is hit on save', async () => {
    const connectionRecord = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Start,
    })

    const connectionRepository = agent.context.resolve(DidCommConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)
    expect(cacheSetSpy).toHaveBeenCalled()
  })

  test('check if cache is hit on get', async () => {
    const storageService = agent.context.resolve<StorageService<DidCommConnectionRecord>>(
      InjectionSymbols.StorageService
    )
    const storageServiceGetByIdSpy = vi.spyOn(storageService, 'getById')

    const connectionRecord = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Start,
    })

    const connectionRepository = agent.context.resolve(DidCommConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)
    await connectionRepository.getById(agent.context, connectionRecord.id)
    expect(cacheGetSpy).toHaveBeenCalled()

    expect(storageServiceGetByIdSpy).not.toHaveBeenCalled()
  })

  test('check if cache is hit on query after two calls', async () => {
    const dids = { theirDid: 'did:theirs', ourDid: 'did:ours' }

    const connectionRecord = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Start,
      theirDid: dids.theirDid,
      did: dids.ourDid,
    })

    const connectionRepository = agent.context.resolve(DidCommConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)

    // Registers the query + result in cache
    const foundConnectionRecord = await connectionRepository.findByDids(agent.context, dids)
    expect(foundConnectionRecord).toBeInstanceOf(DidCommConnectionRecord)
    expect(cacheSetSpy).toHaveBeenCalled()

    const storageService = agent.context.resolve<StorageService<DidCommConnectionRecord>>(
      InjectionSymbols.StorageService
    )
    const storageServiceFindByQuerySpy = vi.spyOn(storageService, 'findByQuery')

    const foundConnectionRecord2 = await connectionRepository.findByDids(agent.context, dids)
    expect(foundConnectionRecord2).toEqual(foundConnectionRecord)

    // Cache should be retrieved
    expect(cacheGetSpy).toHaveBeenCalled()

    // Should not check the persistent storage service
    expect(storageServiceFindByQuerySpy).not.toHaveBeenCalled()
  })
})
