import {
  Agent,
  CacheModule,
  CachedStorageService,
  InjectionSymbols,
  SingleContextStorageLruCache,
  type StorageService,
} from '@credo-ts/core'
import { getAgentOptions } from '../../../../../core/tests'
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
