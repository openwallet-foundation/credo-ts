import type { AgentContext } from '../../../core/src/agent'
import { GetNymRequest, indyVdr,} from 'indy-vdr-test-shared'

import {
  AgentDependencies,
  Logger,
  InjectionSymbols,
  injectable,
  inject,
  LedgerError,
  LedgerNotConfiguredError,
  LedgerNotFoundError,
} from '@aries-framework/core'

import { IndyVdrError, GetNymResponse } from 'indy-vdr-test-shared'
import { CacheRepository, PersistedLruCache } from '../../../core/src/cache'
import { IndySdkError } from '../../../core/src/error'
import { isSelfCertifiedDid } from '../../../core/src/utils/did'
import { isIndyError } from '../../../core/src/utils/indyError'
import { allSettled, onlyFulfilled, onlyRejected } from '../../../core/src/utils/promises'
import { assertIndyWallet } from '../../../core/src/wallet/util/assertIndyWallet'
import { IndyVdrPool } from './IndyVdrPool'

export const DID_POOL_CACHE_ID = 'DID_POOL_CACHE'
export const DID_POOL_CACHE_LIMIT = 500
export interface CachedDidResponse {
  nymResponse: {
    did: string
    verkey: string
  }
  poolId?: string
}
@injectable()
export class IndyVdrPoolService {
  public pools: IndyVdrPool[] = []
  private logger: Logger
  private indyVdr!: typeof indyVdr
  private agentDependencies: AgentDependencies
  private didCache: PersistedLruCache<CachedDidResponse>

  public constructor(
    cacheRepository: CacheRepository,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.logger = logger
    this.agentDependencies = agentDependencies

    this.didCache = new PersistedLruCache(DID_POOL_CACHE_ID, DID_POOL_CACHE_LIMIT, cacheRepository)
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
   * Get the most appropriate pool for the given did. The algorithm is based on the approach as described in this document:
   * https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA/edit
   */
  public async getPoolForDid(agentContext: AgentContext, did: string): Promise<{ pool: IndyVdrPool }> {
    // Check if the did starts with did:indy
    if (did.startsWith('did:indy')) {
      const nameSpace = did.split(':')[2]

      const pool = this.pools.find((pool) => pool.IndyNamespace === nameSpace)

      if (pool) return { pool }

      throw new LedgerNotFoundError('Pool not found')
    } else {
      return await this.getPoolForLegacyDid(agentContext, did)
    }
  }

  private async getPoolForLegacyDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: IndyVdrPool; did: string }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const cachedNymResponse = await this.didCache.get(agentContext, did)
    const pool = this.pools.find((pool) => pool.config.indyNamespace === cachedNymResponse?.poolId)

    // If we have the nym response with associated pool in the cache, we'll use that
    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.id}' for did '${did}' in cache`)
      return { did: cachedNymResponse.nymResponse.did, pool }
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
    let value = successful.find((response) => isSelfCertifiedDid(response.value.did.nymResponse.did, response.value.did.nymResponse.verkey))?.value

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
      nymResponse: {
        did: value.did.nymResponse.did,
        verkey: value.did.nymResponse.verkey,
      },
    })
    return { pool: value.pool, did: value.did.nymResponse.did }
  }

  private async getSettledDidResponsesFromPools(did: string, pools: IndyVdrPool[]) {
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
  public getPoolForNamespace(indyNamespace: string) {
    if (this.pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    if (!indyNamespace) {
      this.logger.warn('Not passing the indyNamespace is deprecated and will be removed in the future version.')
      return this.pools[0]
    }

    const pool = this.pools.find((pool) => pool.config.indyNamespace === indyNamespace) // TODO check if this is corect

    if (!pool) {
      throw new LedgerNotFoundError(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }

  private async getDidFromPool(did: string, pool: IndyVdrPool): Promise<PublicDidRequest> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = await new GetNymRequest({ dest: did })

      this.logger.trace(`Submitting get did request for did '${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        throw new LedgerError('Not Found')
      }

      const result = JSON.parse(response.result.data)

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
  did: CachedDidResponse
  pool: IndyVdrPool
  response: GetNymResponse
}
