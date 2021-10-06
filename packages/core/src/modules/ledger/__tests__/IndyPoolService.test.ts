import type { IndyPoolConfig } from '../IndyPool'
import type { CachedDidResponse } from '../services/IndyPoolService'

import { getAgentConfig, mockFunction } from '../../../../tests/helpers'
import { CacheRecord } from '../../../cache'
import { CacheRepository } from '../../../cache/CacheRepository'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { LedgerError } from '../error/LedgerError'
import { LedgerNotConfiguredError } from '../error/LedgerNotConfiguredError'
import { LedgerNotFoundError } from '../error/LedgerNotFoundError'
import { DID_POOL_CACHE_ID, IndyPoolService } from '../services/IndyPoolService'

import { getDidResponsesForDid } from './didResponses'

jest.mock('../../../cache/CacheRepository')
const CacheRepositoryMock = CacheRepository as jest.Mock<CacheRepository>

const pools: IndyPoolConfig[] = [
  {
    id: 'sovrinMain',
    isProduction: true,
    genesisTransactions: 'xxx',
  },
  {
    id: 'sovrinBuilder',
    isProduction: false,
    genesisTransactions: 'xxx',
  },
  {
    id: 'sovrinStaging',
    isProduction: false,
    genesisTransactions: 'xxx',
  },
  {
    id: 'indicioMain',
    isProduction: true,
    genesisTransactions: 'xxx',
  },
  {
    id: 'bcovrinTest',
    isProduction: false,
    genesisTransactions: 'xxx',
  },
]

describe('InyLedgerService', () => {
  const config = getAgentConfig('IndyLedgerServiceTest', {
    indyLedgers: pools,
  })
  let wallet: IndyWallet
  let poolService: IndyPoolService
  let cacheRepository: CacheRepository

  beforeAll(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.initialize(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    cacheRepository = new CacheRepositoryMock()
    mockFunction(cacheRepository.findById).mockResolvedValue(null)

    poolService = new IndyPoolService(config, cacheRepository)
  })

  describe('ledgerWritePool', () => {
    it('should return the first pool', async () => {
      expect(poolService.ledgerWritePool).toBe(poolService.pools[0])
    })

    it('should throw a LedgerNotConfiguredError error if no pools are configured on the agent', async () => {
      const config = getAgentConfig('IndyLedgerServiceTest', { indyLedgers: [] })
      poolService = new IndyPoolService(config, cacheRepository)

      expect(() => poolService.ledgerWritePool).toThrow(LedgerNotConfiguredError)
    })
  })

  describe('getPoolForDid', () => {
    it('should throw a LedgerNotConfiguredError error if no pools are configured on the agent', async () => {
      const config = getAgentConfig('IndyLedgerServiceTest', { indyLedgers: [] })
      poolService = new IndyPoolService(config, cacheRepository)

      expect(poolService.getPoolForDid('some-did')).rejects.toThrow(LedgerNotConfiguredError)
    })

    it('should throw a LedgerError if all ledger requests throw an error other than NotFoundError', async () => {
      const did = 'Y5bj4SjCiTM9PgeheKAiXx'

      poolService.pools.forEach((pool) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(() => Promise.reject(new AriesFrameworkError('Something went wrong')))
      })

      expect(poolService.getPoolForDid(did)).rejects.toThrowError(LedgerError)
    })

    it('should throw a LedgerNotFoundError if all pools did not find the did on the ledger', async () => {
      const did = 'Y5bj4SjCiTM9PgeheKAiXx'
      // Not found on any of the ledgers
      const responses = getDidResponsesForDid(did, pools, {})

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      expect(poolService.getPoolForDid(did)).rejects.toThrowError(LedgerNotFoundError)
    })

    it('should return the pool if the did was only found on one ledger', async () => {
      const did = 'TL1EaPFCZ8Si5aUrqScBDt'
      // Only found on one ledger
      const responses = getDidResponsesForDid(did, pools, {
        sovrinMain: '~43X4NhAFqREffK7eWdKgFH',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinMain')
    })

    it('should return the production pool if the did was found on one production and one non production ledger', async () => {
      const did = 'V6ty6ttM3EjuCtosH6sGtW'
      // Found on one production and one non production ledger
      const responses = getDidResponsesForDid(did, pools, {
        indicioMain: '~43X4NhAFqREffK7eWdKgFH',
        sovrinBuilder: '~43X4NhAFqREffK7eWdKgFH',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('indicioMain')
    })

    it('should return the pool with the self certified did if the did was found on two production ledgers where one did is self certified', async () => {
      const did = 'VsKV7grR1BUE29mG2Fm2kX'
      // Found on two production ledgers. Sovrin is self certified
      const responses = getDidResponsesForDid(did, pools, {
        sovrinMain: '~43X4NhAFqREffK7eWdKgFH',
        indicioMain: 'kqa2HyagzfMAq42H5f9u3UMwnSBPQx2QfrSyXbUPxMn',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinMain')
    })

    it('should return the first pool with a self certified did if the did was found on three non production ledgers where two DIDs are self certified', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'
      // Found on two non production ledgers. Sovrin is self certified
      const responses = getDidResponsesForDid(did, pools, {
        sovrinBuilder: '~M9kv2Ez61cur7X39DXWh8W',
        sovrinStaging: '~M9kv2Ez61cur7X39DXWh8W',
        bcovrinTest: '3SeuRm3uYuQDYmHeuMLu1xNHozNTtzS3kbZRFMMCWrX4',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinBuilder')
    })

    it('should return the pool from the cache if the did was found in the cache', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'

      const expectedPool = pools[3]

      const didResponse: CachedDidResponse = {
        nymResponse: {
          did,
          role: 'ENDORSER',
          verkey: '~M9kv2Ez61cur7X39DXWh8W',
        },
        poolId: expectedPool.id,
      }

      const cachedEntries = [
        {
          key: did,
          value: didResponse,
        },
      ]

      mockFunction(cacheRepository.findById).mockResolvedValue(
        new CacheRecord({
          id: DID_POOL_CACHE_ID,
          entries: cachedEntries,
        })
      )

      poolService = new IndyPoolService(config, cacheRepository)

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe(pool.id)
    })

    it('should set the poolId in the cache if the did was not found in the cache, but resolved later on', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'
      // Found on one ledger
      const responses = getDidResponsesForDid(did, pools, {
        sovrinBuilder: '~M9kv2Ez61cur7X39DXWh8W',
      })

      mockFunction(cacheRepository.findById).mockResolvedValue(
        new CacheRecord({
          id: DID_POOL_CACHE_ID,
          entries: [],
        })
      )

      const spy = mockFunction(cacheRepository.save).mockResolvedValue()

      poolService = new IndyPoolService(config, cacheRepository)
      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinBuilder')

      const cacheRecord = spy.mock.calls[0][0]
      expect(cacheRecord.entries.length).toBe(1)
      expect(cacheRecord.entries[0].key).toBe(did)
      expect(cacheRecord.entries[0].value).toEqual({
        nymResponse: {
          did,
          verkey: '~M9kv2Ez61cur7X39DXWh8W',
          role: '0',
        },
        poolId: 'sovrinBuilder',
      })
    })
  })
})
