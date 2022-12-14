import type { AgentContext } from '../../../agent'
import type { AcceptanceMechanisms, AuthorAgreement, IndyPoolConfig } from '../IndyPool'
import type { default as Indy, LedgerReadReplyResponse, LedgerRequest, LedgerWriteReplyResponse } from 'indy-sdk'

import { Subject } from 'rxjs'

import { AgentDependencies } from '../../../agent/AgentDependencies'
import { CacheRepository, PersistedLruCache } from '../../../cache'
import { InjectionSymbols } from '../../../constants'
import { IndySdkError } from '../../../error/IndySdkError'
import { Logger } from '../../../logger/Logger'
import { injectable, inject } from '../../../plugins'
import { FileSystem } from '../../../storage/FileSystem'
import { isSelfCertifiedDid } from '../../../utils/did'
import { isIndyError } from '../../../utils/indyError'
import { allSettled, onlyFulfilled, onlyRejected } from '../../../utils/promises'
import { assertIndyWallet } from '../../../wallet/util/assertIndyWallet'
import { IndyPool } from '../IndyPool'
import { LedgerError } from '../error/LedgerError'
import { LedgerNotConfiguredError } from '../error/LedgerNotConfiguredError'
import { LedgerNotFoundError } from '../error/LedgerNotFoundError'

export const DID_POOL_CACHE_ID = 'DID_POOL_CACHE'
export const DID_POOL_CACHE_LIMIT = 500
export interface CachedDidResponse {
  nymResponse: Indy.GetNymResponse
  poolId: string
}
@injectable()
export class IndyPoolService {
  public pools: IndyPool[] = []
  private logger: Logger
  private indy: typeof Indy
  private agentDependencies: AgentDependencies
  private stop$: Subject<boolean>
  private fileSystem: FileSystem
  private didCache: PersistedLruCache<CachedDidResponse>

  public constructor(
    cacheRepository: CacheRepository,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem
  ) {
    this.logger = logger
    this.indy = agentDependencies.indy
    this.agentDependencies = agentDependencies
    this.fileSystem = fileSystem
    this.stop$ = stop$

    this.didCache = new PersistedLruCache(DID_POOL_CACHE_ID, DID_POOL_CACHE_LIMIT, cacheRepository)
  }

  public setPools(poolConfigs: IndyPoolConfig[]) {
    this.pools = poolConfigs.map(
      (poolConfig) => new IndyPool(poolConfig, this.agentDependencies, this.logger, this.stop$, this.fileSystem)
    )
  }

  /**
   * Create connections to all ledger pools
   */
  public async connectToPools() {
    const handleArray: number[] = []
    // Sequentially connect to pools so we don't use up too many resources connecting in parallel
    for (const pool of this.pools) {
      this.logger.debug(`Connecting to pool: ${pool.id}`)
      const poolHandle = await pool.connect()
      this.logger.debug(`Finished connection to pool: ${pool.id}`)
      handleArray.push(poolHandle)
    }
    return handleArray
  }

  /**
   * @deprecated use instead getPoolForNamespace
   * Get the pool used for writing to the ledger. For now we always use the first pool
   *  as the pool that writes to the ledger
   */
  public get ledgerWritePool() {
    if (this.pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    return this.pools[0]
  }

  /**
   * Get the most appropriate pool for the given did. The algorithm is based on the approach as described in this document:
   * https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA/edit
   */
  public async getPoolForDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: IndyPool; did: Indy.GetNymResponse }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const cachedNymResponse = await this.didCache.get(agentContext, did)
    const pool = this.pools.find((pool) => pool.id === cachedNymResponse?.poolId)

    // If we have the nym response with associated pool in the cache, we'll use that
    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.id}' for did '${did}' in cache`)
      return { did: cachedNymResponse.nymResponse, pool }
    }

    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    if (successful.length === 0) {
      const allNotFound = rejected.every((e) => e.reason instanceof LedgerNotFoundError)
      const rejectedOtherThanNotFound = rejected.filter((e) => !(e.reason instanceof LedgerNotFoundError))

      // All ledgers returned response that the did was not found
      if (allNotFound) {
        throw new LedgerNotFoundError(`Did '${did}' not found on any of the ledgers (total ${this.pools.length}).`)
      }

      // one or more of the ledgers returned an unknown error
      throw new LedgerError(
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // indyLedgers config as the order of preference of ledgers
    let value = successful.find((response) =>
      isSelfCertifiedDid(response.value.did.did, response.value.did.verkey)
    )?.value

    if (!value) {
      // Split between production and nonProduction ledgers. If there is at least one
      // successful response from a production ledger, only keep production ledgers
      // otherwise we only keep the non production ledgers.
      const production = successful.filter((s) => s.value.pool.config.isProduction)
      const nonProduction = successful.filter((s) => !s.value.pool.config.isProduction)
      const productionOrNonProduction = production.length >= 1 ? production : nonProduction

      // We take the first value as we take the order in the indyLedgers config as
      // the order of preference of ledgers
      value = productionOrNonProduction[0].value
    }

    await this.didCache.set(agentContext, did, {
      nymResponse: value.did,
      poolId: value.pool.id,
    })
    return { pool: value.pool, did: value.did }
  }

  private async getSettledDidResponsesFromPools(did: string, pools: IndyPool[]) {
    this.logger.trace(`Retrieving did '${did}' from ${pools.length} ledgers`)
    const didResponses = await allSettled(pools.map((pool) => this.getDidFromPool(did, pool)))

    const successful = onlyFulfilled(didResponses)
    this.logger.trace(`Retrieved ${successful.length} responses from ledgers for did '${did}'`)

    const rejected = onlyRejected(didResponses)

    return {
      rejected,
      successful,
    }
  }

  /**
   * Get the most appropriate pool for the given indyNamespace
   */
  public getPoolForNamespace(indyNamespace?: string) {
    if (this.pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    if (!indyNamespace) {
      this.logger.warn('Not passing the indyNamespace is deprecated and will be removed in the future version.')
      return this.pools[0]
    }

    const pool = this.pools.find((pool) => pool.didIndyNamespace === indyNamespace)

    if (!pool) {
      throw new LedgerNotFoundError(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }

  public async submitWriteRequest(
    agentContext: AgentContext,
    pool: IndyPool,
    request: LedgerRequest,
    signDid: string
  ): Promise<LedgerWriteReplyResponse> {
    try {
      const requestWithTaa = await this.appendTaa(pool, request)
      const signedRequestWithTaa = await this.signRequest(agentContext, signDid, requestWithTaa)

      const response = await pool.submitWriteRequest(signedRequestWithTaa)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async submitReadRequest(pool: IndyPool, request: LedgerRequest): Promise<LedgerReadReplyResponse> {
    try {
      const response = await pool.submitReadRequest(request)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async signRequest(agentContext: AgentContext, did: string, request: LedgerRequest): Promise<LedgerRequest> {
    assertIndyWallet(agentContext.wallet)

    try {
      return this.indy.signRequest(agentContext.wallet.handle, did, request)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async appendTaa(pool: IndyPool, request: Indy.LedgerRequest) {
    try {
      const authorAgreement = await this.getTransactionAuthorAgreement(pool)
      const taa = pool.config.transactionAuthorAgreement

      // If ledger does not have TAA, we can just send request
      if (authorAgreement == null) {
        return request
      }
      // Ledger has taa but user has not specified which one to use
      if (!taa) {
        throw new LedgerError(
          `Please, specify a transaction author agreement with version and acceptance mechanism. ${JSON.stringify(
            authorAgreement
          )}`
        )
      }

      // Throw an error if the pool doesn't have the specified version and acceptance mechanism
      if (
        authorAgreement.version !== taa.version ||
        !(taa.acceptanceMechanism in authorAgreement.acceptanceMechanisms.aml)
      ) {
        // Throw an error with a helpful message
        const errMessage = `Unable to satisfy matching TAA with mechanism ${JSON.stringify(
          taa.acceptanceMechanism
        )} and version ${JSON.stringify(taa.version)} in pool.\n Found ${JSON.stringify(
          Object.keys(authorAgreement.acceptanceMechanisms.aml)
        )} and version ${authorAgreement.version} in pool.`
        throw new LedgerError(errMessage)
      }

      const requestWithTaa = await this.indy.appendTxnAuthorAgreementAcceptanceToRequest(
        request,
        authorAgreement.text,
        taa.version,
        authorAgreement.digest,
        taa.acceptanceMechanism,
        // Current time since epoch
        // We can't use ratification_ts, as it must be greater than 1499906902
        Math.floor(new Date().getTime() / 1000)
      )

      return requestWithTaa
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async getTransactionAuthorAgreement(pool: IndyPool): Promise<AuthorAgreement | null> {
    try {
      // TODO Replace this condition with memoization
      if (pool.authorAgreement !== undefined) {
        return pool.authorAgreement
      }

      const taaRequest = await this.indy.buildGetTxnAuthorAgreementRequest(null)
      const taaResponse = await this.submitReadRequest(pool, taaRequest)
      const acceptanceMechanismRequest = await this.indy.buildGetAcceptanceMechanismsRequest(null)
      const acceptanceMechanismResponse = await this.submitReadRequest(pool, acceptanceMechanismRequest)

      // TAA can be null
      if (taaResponse.result.data == null) {
        pool.authorAgreement = null
        return null
      }

      // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
      const authorAgreement = taaResponse.result.data as AuthorAgreement
      const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms
      pool.authorAgreement = {
        ...authorAgreement,
        acceptanceMechanisms,
      }
      return pool.authorAgreement
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async getDidFromPool(did: string, pool: IndyPool): Promise<PublicDidRequest> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = await this.indy.buildGetNymRequest(null, did)

      this.logger.trace(`Submitting get did request for did '${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      const result = await this.indy.parseGetNymResponse(response)
      this.logger.trace(`Retrieved did '${did}' from ledger '${pool.id}'`, result)

      return {
        did: result,
        pool,
        response,
      }
    } catch (error) {
      this.logger.trace(`Error retrieving did '${did}' from ledger '${pool.id}'`, {
        error,
        did,
      })
      if (isIndyError(error, 'LedgerNotFound')) {
        throw new LedgerNotFoundError(`Did '${did}' not found on ledger ${pool.id}`)
      } else {
        throw isIndyError(error) ? new IndySdkError(error) : error
      }
    }
  }
}

export interface PublicDidRequest {
  did: Indy.GetNymResponse
  pool: IndyPool
  response: Indy.LedgerReadReplyResponse
}
