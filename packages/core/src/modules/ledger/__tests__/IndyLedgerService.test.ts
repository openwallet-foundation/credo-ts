import type { IndyPoolConfig } from '../IndyPool'
import type { LedgerReadReplyResponse, LedgerWriteReplyResponse } from 'indy-sdk'

import { getAgentConfig, mockFunction } from '../../../../tests/helpers'
import { CacheRepository } from '../../../cache/CacheRepository'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyPool } from '../IndyPool'
import { IndyLedgerService } from '../services/IndyLedgerService'
import { IndyPoolService } from '../services/IndyPoolService'

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
    transactionAuthorAgreement: { version: '1.0', acceptanceMechanism: 'accept' },
  },
]

describe('IndyLedgerService', () => {
  const config = getAgentConfig('IndyLedgerServiceTest', {
    indyLedgers: pools,
  })
  let wallet: IndyWallet
  let poolService: IndyPoolService
  let cacheRepository: CacheRepository
  let indyIssuerService: IndyIssuerService
  let ledgerService: IndyLedgerService

  beforeAll(async () => {
    wallet = new IndyWallet(config)
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
    const pool = new IndyPool(config, pools[0])
    jest.spyOn(pool, 'submitWriteRequest').mockResolvedValue({} as LedgerWriteReplyResponse)
    jest.spyOn(pool, 'submitReadRequest').mockResolvedValue({} as LedgerReadReplyResponse)
    jest.spyOn(pool, 'connect').mockResolvedValue(0)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    poolService.ledgerWritePool = pool

    ledgerService = new IndyLedgerService(wallet, config, indyIssuerService, poolService)
  })

  describe('LedgerServiceWrite', () => {
    it('should throw an error if the config version does not match', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
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
        ledgerService.registerPublicDid(
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1.0" in pool.\n Found ["accept"] and version 2.0 in pool.'
      )
    })

    it('should throw an error if the config acceptance mechanism does not match', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
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
        ledgerService.registerPublicDid(
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(
        'Unable to satisfy matching TAA with mechanism "accept" and version "1.0" in pool.\n Found ["decline"] and version 1.0 in pool.'
      )
    })

    it('should throw an error if no config is present', async () => {
      poolService.ledgerWritePool.authorAgreement = undefined
      poolService.ledgerWritePool.config.transactionAuthorAgreement = undefined

      ledgerService = new IndyLedgerService(wallet, config, indyIssuerService, poolService)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(ledgerService, 'getTransactionAuthorAgreement').mockResolvedValue({
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
        ledgerService.registerPublicDid(
          'BBPoJqRKatdcfLEAFL7exC',
          'N8NQHLtCKfPmWMgCSdfa7h',
          'GAb4NUvpBcHVCvtP45vTVa5Bp74vFg3iXzdp1Gbd68Wf',
          'Heinz57'
        )
      ).rejects.toThrowError(/Please, specify a transaction author agreement with version and acceptance mechanism/)
    })
  })
})
