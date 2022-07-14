import type { AgentContext } from '../../../agent'
import type { IndyPoolConfig } from '../IndyPool'
import type { LedgerReadReplyResponse, LedgerWriteReplyResponse } from 'indy-sdk'

import { Subject } from 'rxjs'

import { NodeFileSystem } from '../../../../../node/src/NodeFileSystem'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../tests/helpers'
import { CacheRepository } from '../../../cache/CacheRepository'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyPool } from '../IndyPool'
import { IndyLedgerService } from '../services/IndyLedgerService'
import { IndyPoolService } from '../services/IndyPoolService'
import { SigningProviderRegistry } from '../../../crypto/signing-provider'

jest.mock('../services/IndyPoolService')
const IndyPoolServiceMock = IndyPoolService as jest.Mock<IndyPoolService>
jest.mock('../../indy/services/IndyIssuerService')
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>
jest.mock('../../../cache/CacheRepository')
const CacheRepositoryMock = CacheRepository as jest.Mock<CacheRepository>

const pools: IndyPoolConfig[] = [
  {
    id: 'sovrinMain',
    isProduction: true,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
]

describe('IndyLedgerService', () => {
  const config = getAgentConfig('IndyLedgerServiceTest', {
    indyLedgers: pools,
  })
  let wallet: IndyWallet
  let agentContext: AgentContext
  let poolService: IndyPoolService
  let cacheRepository: CacheRepository
  let indyIssuerService: IndyIssuerService
  let ledgerService: IndyLedgerService

  beforeAll(async () => {
    wallet = new IndyWallet(config.agentDependencies, config.logger, new SigningProviderRegistry([]))
    agentContext = getAgentContext()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    cacheRepository = new CacheRepositoryMock()
    mockFunction(cacheRepository.findById).mockResolvedValue(null)
    indyIssuerService = new IndyIssuerServiceMock()
    poolService = new IndyPoolServiceMock()
    const pool = new IndyPool(pools[0], config.agentDependencies, config.logger, new Subject(), new NodeFileSystem())
    jest.spyOn(pool, 'submitWriteRequest').mockResolvedValue({} as LedgerWriteReplyResponse)
    jest.spyOn(pool, 'submitReadRequest').mockResolvedValue({} as LedgerReadReplyResponse)
    jest.spyOn(pool, 'connect').mockResolvedValue(0)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    poolService.ledgerWritePool = pool

    ledgerService = new IndyLedgerService(config.agentDependencies, config.logger, indyIssuerService, poolService)
  })

  describe('LedgerServiceWrite', () => {
    it('should throw an error if the config version does not match', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: 'abdcg',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { accept: 'accept' },
          amlContext: 'accept',
          version: '3',
        },
      } as never)
      await expect(
        ledgerService.registerPublicDid(
          agentContext,
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1" in pool.\n Found ["accept"] and version 3 in pool.'
      )
    })

    it('should throw an error if the config acceptance mechanism does not match', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: 'abdcg',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { decline: 'accept' },
          amlContext: 'accept',
          version: '1',
        },
      } as never)
      await expect(
        ledgerService.registerPublicDid(
          agentContext,
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1" in pool.\n Found ["decline"] and version 1 in pool.'
      )
    })

    it('should throw an error if no config is present', async () => {
      poolService.ledgerWritePool.authorAgreement = undefined
      poolService.ledgerWritePool.config.transactionAuthorAgreement = undefined

      ledgerService = new IndyLedgerService(config.agentDependencies, config.logger, indyIssuerService, poolService)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
        digest: 'abcde',
        version: 'abdcg',
        text: 'jhsdhbv',
        ratification_ts: 12345678,
        acceptanceMechanisms: {
          aml: { accept: 'accept' },
          amlContext: 'accept',
          version: '3',
        },
      } as never)
      await expect(
        ledgerService.registerPublicDid(
          agentContext,
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(/Please, specify a transaction author agreement with version and acceptance mechanism/)
    })
  })
})
