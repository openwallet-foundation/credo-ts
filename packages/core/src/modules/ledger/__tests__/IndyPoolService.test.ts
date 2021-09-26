import type { IndyPoolConfig } from '../IndyPool'

import { IndyPoolService } from '..'
import { getAgentConfig } from '../../../../tests/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { LedgerError } from '../error/LedgerError'
import { LedgerNotConfiguredError } from '../error/LedgerNotConfiguredError'
import { LedgerNotFoundError } from '../error/LedgerNotFoundError'

import { getDidResponsesForDid } from './didResponses'

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

  beforeAll(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.initialize(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    poolService = new IndyPoolService(config)
  })

  describe('ledgerWritePool', () => {
    it('should return the first pool', async () => {
      expect(poolService.ledgerWritePool).toBe(poolService.pools[0])
    })

    it('should throw a LedgerNotConfiguredError error if no pools are configured on the agent', async () => {
      const config = getAgentConfig('IndyLedgerServiceTest', { indyLedgers: [] })
      poolService = new IndyPoolService(config)

      expect(() => poolService.ledgerWritePool).toThrow(LedgerNotConfiguredError)
    })
  })

  describe('getPoolForDid', () => {
    it('should throw a LedgerNotConfiguredError error if no pools are configured on the agent', async () => {
      const config = getAgentConfig('IndyLedgerServiceTest', { indyLedgers: [] })
      poolService = new IndyPoolService(config)

      expect(poolService.getPoolForDid('some-did')).rejects.toThrow(LedgerNotConfiguredError)
    })

    it('should throw a LedgerError if one of the ledger requests throws an error other than NotFoundError', async () => {
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
        sovrinMain: {
          txnTime: 1632680963,
          verkey: '~43X4NhAFqREffK7eWdKgFH',
        },
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
        indicioMain: {
          txnTime: 1632680963,
          verkey: '~43X4NhAFqREffK7eWdKgFH',
        },
        sovrinBuilder: {
          txnTime: 1632680963,
          verkey: '~43X4NhAFqREffK7eWdKgFH',
        },
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
        sovrinMain: {
          txnTime: 1632680963,
          verkey: '~43X4NhAFqREffK7eWdKgFH',
        },
        indicioMain: {
          txnTime: 1632680963,
          verkey: 'kqa2HyagzfMAq42H5f9u3UMwnSBPQx2QfrSyXbUPxMn',
        },
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinMain')
    })

    it('should return the pool with the did with the earlier txnTime if the did was found on two production ledgers where both DIDs are self certified', async () => {
      const did = 'JHVT5Zv86TrJUJYysET4ij'
      // Found on two production ledgers. Indicio txnTime is earlier than
      // Sovrin txnTime
      const responses = getDidResponsesForDid(did, pools, {
        sovrinMain: {
          txnTime: 1632680963,
          verkey: '~QTQYRnDeYdbo8NDEkWC2Bt',
        },
        indicioMain: {
          txnTime: 1632680000,
          verkey: '~QTQYRnDeYdbo8NDEkWC2Bt',
        },
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('indicioMain')
    })

    it('should return the pool with the self certified did if the did was found on two non production ledgers where one did is self certified', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'
      // Found on two non production ledgers. Sovrin is self certified
      const responses = getDidResponsesForDid(did, pools, {
        sovrinBuilder: {
          txnTime: 1632680963,
          verkey: '~M9kv2Ez61cur7X39DXWh8W',
        },
        bcovrinTest: {
          txnTime: 1632680963,
          verkey: '3SeuRm3uYuQDYmHeuMLu1xNHozNTtzS3kbZRFMMCWrX4',
        },
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(did)

      expect(pool.config.id).toBe('sovrinBuilder')
    })
  })
})
