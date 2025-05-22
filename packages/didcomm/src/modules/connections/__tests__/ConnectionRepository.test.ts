import {
  Agent,
  CacheModule,
  CachedStorageService,
  InjectionSymbols,
  SingleContextStorageLruCache,
  StorageService,
} from '@credo-ts/core'
import { getAgentOptions } from '../../../../../core/tests'
import { DidExchangeRole, DidExchangeState } from '../models'
import { ConnectionRecord, ConnectionRepository } from '../repository'

const cache = new SingleContextStorageLruCache({ limit: 500 })
const cacheSetSpy = jest.spyOn(cache, 'set')
const cacheGetSpy = jest.spyOn(cache, 'get')

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
    const connectionRecord = new ConnectionRecord({
      role: DidExchangeRole.Requester,
      state: DidExchangeState.Start,
    })

    const connectionRepository = agent.context.resolve(ConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)
    expect(cacheSetSpy).toHaveBeenCalled()
  })

  test('check if cache is hit on get', async () => {
    const storageService = agent.context.resolve<StorageService<ConnectionRecord>>(InjectionSymbols.StorageService)
    const storageServiceGetByIdSpy = jest.spyOn(storageService, 'getById')

    const connectionRecord = new ConnectionRecord({
      role: DidExchangeRole.Requester,
      state: DidExchangeState.Start,
    })

    const connectionRepository = agent.context.resolve(ConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)
    await connectionRepository.getById(agent.context, connectionRecord.id)
    expect(cacheGetSpy).toHaveBeenCalled()

    expect(storageServiceGetByIdSpy).not.toHaveBeenCalled()
  })

  test('check if cache is hit on query after two calls', async () => {
    const dids = { theirDid: 'did:theirs', ourDid: 'did:ours' }

    const connectionRecord = new ConnectionRecord({
      role: DidExchangeRole.Requester,
      state: DidExchangeState.Start,
      theirDid: dids.theirDid,
      did: dids.ourDid,
    })

    const connectionRepository = agent.context.resolve(ConnectionRepository)
    await connectionRepository.save(agent.context, connectionRecord)

    // Registers the query + result in cache
    const foundConnectionRecord = await connectionRepository.findByDids(agent.context, dids)
    expect(foundConnectionRecord).toBeInstanceOf(ConnectionRecord)
    expect(cacheSetSpy).toHaveBeenCalled()

    const storageService = agent.context.resolve<StorageService<ConnectionRecord>>(InjectionSymbols.StorageService)
    const storageServiceFindByQuerySpy = jest.spyOn(storageService, 'findByQuery')

    const foundConnectionRecord2 = await connectionRepository.findByDids(agent.context, dids)
    expect(foundConnectionRecord2).toEqual(foundConnectionRecord)

    // Cache should be retrieved
    expect(cacheGetSpy).toHaveBeenCalled()

    // Should not check the persistent storage service
    expect(storageServiceFindByQuerySpy).not.toHaveBeenCalled()
  })
})
