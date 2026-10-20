import {
  Agent,
  type AgentContext,
  CachedStorageService,
  CacheModule,
  CacheModuleConfig,
  EventEmitter,
  InjectionSymbols,
  InMemoryLruCache,
  SingleContextStorageLruCache,
  type StorageService,
} from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { getAgentContext, getAgentOptions } from '../../../../../core/tests'
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

  describe('findByDids with several matches', () => {
    const dids = { ourDid: 'did:example:our', theirDid: 'did:example:their' }
    const props = { role: DidCommDidExchangeRole.Responder, state: DidCommDidExchangeState.Completed }
    let agentContext: AgentContext
    let storageService: InMemoryStorageService<DidCommConnectionRecord>
    let connectionRepository: DidCommConnectionRepository

    beforeEach(() => {
      agentContext = getAgentContext({
        registerInstances: [
          [
            CacheModuleConfig,
            new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }), useCachedStorageService: true }),
          ],
        ],
      })
      storageService = new InMemoryStorageService()
      connectionRepository = new DidCommConnectionRepository(
        storageService,
        new EventEmitter(agentContext.config.agentDependencies, new Subject())
      )
    })

    it.each([
      {
        label: 'their previous DID loses to our previous DID',
        loser: { did: 'did:example:our', theirDid: 'did:example:their-new', previousTheirDids: ['did:example:their'] },
        winner: { did: 'did:example:our-new', previousDids: ['did:example:our'], theirDid: 'did:example:their' },
      },
      {
        label: 'our previous DID loses to the exact pair',
        loser: { did: 'did:example:our-new', previousDids: ['did:example:our'], theirDid: 'did:example:their' },
        winner: { did: 'did:example:our', theirDid: 'did:example:their' },
      },
      {
        label: 'a newer exact match loses to an older one',
        loser: { did: 'did:example:our', theirDid: 'did:example:their', createdAt: new Date('2026-01-02') },
        winner: { did: 'did:example:our', theirDid: 'did:example:their', createdAt: new Date('2026-01-01') },
      },
    ])('picks the closest: $label', async ({ loser, winner }) => {
      const expected = new DidCommConnectionRecord({ ...props, ...winner })
      await connectionRepository.save(agentContext, new DidCommConnectionRecord({ ...props, ...loser }))
      await connectionRepository.save(agentContext, expected)

      expect((await connectionRepository.findByDids(agentContext, dids))?.id).toBe(expected.id)
    })

    it('caches the pick', async () => {
      const exactPair = { ...props, did: dids.ourDid, theirDid: dids.theirDid }
      await connectionRepository.save(agentContext, new DidCommConnectionRecord(exactPair))
      await connectionRepository.save(agentContext, new DidCommConnectionRecord(exactPair))
      const connection = await connectionRepository.findByDids(agentContext, dids)
      const findByQuery = vi.spyOn(storageService, 'findByQuery')

      expect(await connectionRepository.findByDids(agentContext, dids)).toEqual(connection)
      expect(findByQuery).not.toHaveBeenCalled()
    })
  })
})
