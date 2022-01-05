import type { Logger } from '../../../logger/Logger'
import type * as Indy from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { PersistedLruCache, CacheRepository } from '../../../cache'
import { IndySdkError } from '../../../error/IndySdkError'
import { isSelfCertifiedDid } from '../../../utils/did'
import { isIndyError } from '../../../utils/indyError'
import { allSettled, onlyFulfilled, onlyRejected } from '../../../utils/promises'
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

@scoped(Lifecycle.ContainerScoped)
export class IndyPoolService {
  public readonly pools: IndyPool[]
  private logger: Logger
  private indy: typeof Indy
  private didCache: PersistedLruCache<CachedDidResponse>

  public constructor(agentConfig: AgentConfig, cacheRepository: CacheRepository) {
    this.pools = agentConfig.indyLedgers.map((poolConfig) => new IndyPool(agentConfig, poolConfig))
    this.logger = agentConfig.logger
    this.indy = agentConfig.agentDependencies.indy

    this.didCache = new PersistedLruCache(DID_POOL_CACHE_ID, DID_POOL_CACHE_LIMIT, cacheRepository)
  }

  /**
   * Create connections to all ledger pools
   */
  public async connectToPools() {
    const poolsPromises = this.pools.map((pool) => {
      return pool.connect()
    })
    return Promise.all(poolsPromises)
  }

  /**
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
  public async getPoolForDid(did: string): Promise<{ pool: IndyPool; did: Indy.GetNymResponse }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const cachedNymResponse = await this.didCache.get(did)
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

    await this.didCache.set(did, {
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
