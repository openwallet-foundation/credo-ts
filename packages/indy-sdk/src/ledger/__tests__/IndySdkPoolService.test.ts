import type { IndySdkPoolConfig } from '../IndySdkPool'
import type { CachedDidResponse } from '../IndySdkPoolService'

import {
  CacheModuleConfig,
  InMemoryLruCache,
  SigningProviderRegistry,
  AriesFrameworkError,
  Key,
  KeyType,
} from '@aries-framework/core'
import indySdk from 'indy-sdk'
import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import { IndySdkModuleConfig } from '../../IndySdkModuleConfig'
import { IndySdkWallet } from '../../wallet/IndySdkWallet'
import { IndySdkPoolService } from '../IndySdkPoolService'
import { IndySdkPoolError, IndySdkPoolNotConfiguredError, IndySdkPoolNotFoundError } from '../error'

import { getDidResponsesForDid } from './didResponses'

const pools: IndySdkPoolConfig[] = [
  {
    indyNamespace: 'sovrin',
    isProduction: true,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
  {
    indyNamespace: 'sovrin:builder',
    isProduction: false,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
  {
    indyNamespace: 'sovrin:staging',
    isProduction: false,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
  {
    indyNamespace: 'indicio',
    isProduction: true,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
  {
    indyNamespace: 'bcovrin:test',
    isProduction: false,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
]

const config = getAgentConfig('IndySdkPoolServiceTest')
const cache = new InMemoryLruCache({ limit: 1 })

const indySdkModule = new IndySdkModuleConfig({ indySdk, networks: pools })
const wallet = new IndySdkWallet(indySdk, config.logger, new SigningProviderRegistry([]))

const agentContext = getAgentContext({
  wallet,
  registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache })]],
})

const poolService = new IndySdkPoolService(config.logger, new Subject<boolean>(), new NodeFileSystem(), indySdkModule)

describe('IndySdkPoolService', () => {
  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  afterEach(() => {
    cache.clear()
  })

  describe('getPoolForDid', () => {
    it('should throw a IndySdkPoolNotConfiguredError error if no pools are configured on the pool service', async () => {
      const oldPools = poolService.pools
      poolService.pools = []

      expect(poolService.getPoolForDid(agentContext, 'some-did')).rejects.toThrow(IndySdkPoolNotConfiguredError)

      poolService.pools = oldPools
    })

    it('should throw a IndySdkPoolError if all ledger requests throw an error other than NotFoundError', async () => {
      const did = 'Y5bj4SjCiTM9PgeheKAiXx'

      poolService.pools.forEach((pool) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(() => Promise.reject(new AriesFrameworkError('Something went wrong')))
      })

      expect(poolService.getPoolForDid(agentContext, did)).rejects.toThrowError(IndySdkPoolError)
    })

    it('should throw a IndySdkPoolNotFoundError if all pools did not find the did on the ledger', async () => {
      const did = 'Y5bj4SjCiTM9PgeheKAiXx'
      // Not found on any of the ledgers
      const responses = getDidResponsesForDid(did, pools, {})

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      expect(poolService.getPoolForDid(agentContext, did)).rejects.toThrowError(IndySdkPoolNotFoundError)
    })

    it('should return the pool based on namespace if did is a valid did:indy did', async () => {
      const { pool } = await poolService.getPoolForDid(agentContext, 'did:indy:sovrin:Y5bj4SjCiTM9PgeheKAiXx')

      expect(pool.didIndyNamespace).toBe('sovrin')
    })

    it('should return the pool if the did was only found on one ledger', async () => {
      const did = 'TL1EaPFCZ8Si5aUrqScBDt'
      // Only found on one ledger
      const responses = getDidResponsesForDid(did, pools, {
        sovrin: '~43X4NhAFqREffK7eWdKgFH',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('sovrin')
    })

    it('should return the first pool with a self certifying DID if at least one did is self certifying ', async () => {
      const did = 'did:sov:q7ATwTYbQDgiigVijUAej'
      // Found on one production and one non production ledger
      const responses = getDidResponsesForDid(did, pools, {
        indicio: '~43X4NhAFqREffK7eWdKgFH',
        'bcovrin:test': '43X4NhAFqREffK7eWdKgFH43X4NhAFqREffK7eWdKgFH',
        'sovrin:builder': '~43X4NhAFqREffK7eWdKgFH',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('sovrin:builder')
    })

    it('should return the production pool if the did was found on one production and one non production ledger and both DIDs are not self certifying', async () => {
      const did = 'V6ty6ttM3EjuCtosH6sGtW'
      // Found on one production and one non production ledger
      const responses = getDidResponsesForDid(did, pools, {
        indicio: '43X4NhAFqREffK7eWdKgFH43X4NhAFqREffK7eWdKgFH',
        'sovrin:builder': '43X4NhAFqREffK7eWdKgFH43X4NhAFqREffK7eWdKgFH',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('indicio')
    })

    it('should return the pool with the self certified did if the did was found on two production ledgers where one did is self certified', async () => {
      const did = 'VsKV7grR1BUE29mG2Fm2kX'
      // Found on two production ledgers. Sovrin is self certified
      const responses = getDidResponsesForDid(did, pools, {
        sovrin: '~43X4NhAFqREffK7eWdKgFH',
        indicio: 'kqa2HyagzfMAq42H5f9u3UMwnSBPQx2QfrSyXbUPxMn',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('sovrin')
    })

    it('should return the first pool with a self certified did if the did was found on three non production ledgers where two DIDs are self certified', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'
      // Found on two non production ledgers. Sovrin is self certified
      const responses = getDidResponsesForDid(did, pools, {
        'sovrin:builder': '~M9kv2Ez61cur7X39DXWh8W',
        'sovrin:staging': '~M9kv2Ez61cur7X39DXWh8W',
        'bcovrin:test': '3SeuRm3uYuQDYmHeuMLu1xNHozNTtzS3kbZRFMMCWrX4',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('sovrin:builder')
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
        indyNamespace: expectedPool.indyNamespace,
      }

      await cache.set(agentContext, `IndySdkPoolService:${did}`, didResponse)
      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe(pool.didIndyNamespace)
    })

    it('should set the indyNamespace in the cache if the did was not found in the cache, but resolved later on', async () => {
      const did = 'HEi9QViXNThGQaDsQ3ptcw'
      // Found on one ledger
      const responses = getDidResponsesForDid(did, pools, {
        'sovrin:builder': '~M9kv2Ez61cur7X39DXWh8W',
      })

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'submitReadRequest')
        spy.mockImplementationOnce(responses[index])
      })

      const { pool } = await poolService.getPoolForDid(agentContext, did)

      expect(pool.config.indyNamespace).toBe('sovrin:builder')
      expect(pool.config.indyNamespace).toBe('sovrin:builder')

      expect(await cache.get(agentContext, `IndySdkPoolService:${did}`)).toEqual({
        nymResponse: {
          did,
          verkey: '~M9kv2Ez61cur7X39DXWh8W',
          role: '0',
        },
        indyNamespace: 'sovrin:builder',
      })
    })
  })

  describe('getPoolForNamespace', () => {
    it('should throw a IndySdkPoolNotConfiguredError error if no pools are configured on the pool service', async () => {
      const oldPools = poolService.pools
      poolService.pools = []

      expect(() => poolService.getPoolForNamespace()).toThrow(IndySdkPoolNotConfiguredError)

      poolService.pools = oldPools
    })

    it('should return the first pool if indyNamespace is not provided', async () => {
      const expectedPool = pools[0]

      expect(poolService.getPoolForNamespace().didIndyNamespace).toEqual(expectedPool.indyNamespace)
    })

    it('should throw a IndySdkPoolNotFoundError error if any of the pools did not have the provided indyNamespace', async () => {
      const indyNameSpace = 'test'
      const responses = pools.map((pool) => pool.indyNamespace)

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'didIndyNamespace', 'get')
        spy.mockReturnValueOnce(responses[index])
      })

      expect(() => poolService.getPoolForNamespace(indyNameSpace)).toThrow(IndySdkPoolNotFoundError)
    })

    it('should return the first pool that indyNamespace matches', async () => {
      const expectedPool = pools[3]
      const indyNameSpace = 'indicio'
      const responses = pools.map((pool) => pool.indyNamespace)

      poolService.pools.forEach((pool, index) => {
        const spy = jest.spyOn(pool, 'didIndyNamespace', 'get')
        spy.mockReturnValueOnce(responses[index])
      })

      const pool = poolService.getPoolForNamespace(indyNameSpace)

      expect(pool.didIndyNamespace).toEqual(expectedPool.indyNamespace)
    })
  })

  describe('submitWriteRequest', () => {
    it('should throw an error if the config version does not match', async () => {
      const pool = poolService.getPoolForNamespace()

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(poolService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: '2.0',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { accept: 'accept' },
          amlContext: 'accept',
          version: '3',
        },
      } as never)
      await expect(
        poolService.submitWriteRequest(
          agentContext,
          pool,
          {
            reqId: 1668174449192969000,
            identifier: 'BBPoJqRKatdcfLEAFL7exC',
            operation: {
              type: '1',
              dest: 'N8NQHLtCKfPmWMgCSdfa7h',
              verkey: 'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
              alias: 'Heinz57',
            },
            protocolVersion: 2,
          },
          Key.fromPublicKeyBase58('GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf', KeyType.Ed25519)
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1" in pool.\n Found ["accept"] and version 2.0 in pool.'
      )
    })

    it('should throw an error if the config acceptance mechanism does not match', async () => {
      const pool = poolService.getPoolForNamespace()

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(poolService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: '1.0',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { decline: 'accept' },
          amlContext: 'accept',
          version: '1',
        },
      } as never)
      await expect(
        poolService.submitWriteRequest(
          agentContext,
          pool,
          {
            reqId: 1668174449192969000,
            identifier: 'BBPoJqRKatdcfLEAFL7exC',
            operation: {
              type: '1',
              dest: 'N8NQHLtCKfPmWMgCSdfa7h',
              verkey: 'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
              alias: 'Heinz57',
            },
            protocolVersion: 2,
          },
          Key.fromPublicKeyBase58('GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf', KeyType.Ed25519)
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1" in pool.\n Found ["decline"] and version 1.0 in pool.'
      )
    })

    it('should throw an error if no config is present', async () => {
      const pool = poolService.getPoolForNamespace()
      pool.authorAgreement = undefined
      pool.config.transactionAuthorAgreement = undefined

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(poolService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: '1.0',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { accept: 'accept' },
          amlContext: 'accept',
          version: '3',
        },
      } as never)
      await expect(
        poolService.submitWriteRequest(
          agentContext,
          pool,
          {
            reqId: 1668174449192969000,
            identifier: 'BBPoJqRKatdcfLEAFL7exC',
            operation: {
              type: '1',
              dest: 'N8NQHLtCKfPmWMgCSdfa7h',
              verkey: 'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
              alias: 'Heinz57',
            },
            protocolVersion: 2,
          },
          Key.fromPublicKeyBase58('GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf', KeyType.Ed25519)
        )
      ).rejects.toThrowError(/Please, specify a transaction author agreement with version and acceptance mechanism/)
    })
  })
})
