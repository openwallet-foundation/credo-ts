import { didIndyRegex } from '@credo-ts/anoncreds'
import type { AgentContext } from '@credo-ts/core'
import { CacheModuleConfig, InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type { GetNymResponse } from '@hyperledger/indy-vdr-shared'
import { GetNymRequest } from '@hyperledger/indy-vdr-shared'
import { IndyVdrError, IndyVdrNotConfiguredError, IndyVdrNotFoundError } from '../error'
import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'
import { isSelfCertifiedDid } from '../utils/did'
import { allSettled, onlyFulfilled, onlyRejected } from '../utils/promises'

import { IndyVdrPool } from './IndyVdrPool'

export interface CachedDidResponse {
  nymResponse: {
    did: string
    verkey: string
  }
  indyNamespace: string
}
@injectable()
export class IndyVdrPoolService {
  public pools: IndyVdrPool[] = []
  private logger: Logger
  private indyVdrModuleConfig: IndyVdrModuleConfig

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, indyVdrModuleConfig: IndyVdrModuleConfig) {
    this.logger = logger
    this.indyVdrModuleConfig = indyVdrModuleConfig

    this.pools = this.indyVdrModuleConfig.networks.map((poolConfig) => new IndyVdrPool(poolConfig))
  }

  /**
   * Get the most appropriate pool for the given did.
   * If the did is a qualified indy did, the pool will be determined based on the namespace.
   * If it is a legacy unqualified indy did, the pool will be determined based on the algorithm as described in this document:
   * https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA/edit
   *
   * This method will optionally return a nym response when the did has been resolved to determine the ledger
   * either now or in the past. The nymResponse can be used to prevent multiple ledger quries fetching the same
   * did
   */
  public async getPoolForDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: IndyVdrPool; nymResponse?: CachedDidResponse['nymResponse'] }> {
    // Check if the did starts with did:indy
    const match = did.match(didIndyRegex)

    if (match) {
      const [, namespace] = match

      const pool = this.getPoolForNamespace(namespace)

      if (pool) return { pool }

      throw new IndyVdrError(`Pool for indy namespace '${namespace}' not found`)
    }
    return await this.getPoolForLegacyDid(agentContext, did)
  }

  private async getPoolForLegacyDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: IndyVdrPool; nymResponse?: CachedDidResponse['nymResponse'] }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new IndyVdrNotConfiguredError(
        'No indy ledgers configured. Provide at least one pool configuration in IndyVdrModuleConfigOptions.networks'
      )
    }

    const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
    const cacheKey = `IndyVdrPoolService:${did}`

    const cachedNymResponse = await cache.get<CachedDidResponse>(agentContext, cacheKey)
    const pool = this.pools.find((pool) => pool.indyNamespace === cachedNymResponse?.indyNamespace)

    // If we have the nym response with associated pool in the cache, we'll use that
    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.indyNamespace}' for did '${did}' in cache`)
      return { pool, nymResponse: cachedNymResponse.nymResponse }
    }

    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    if (successful.length === 0) {
      const allNotFound = rejected.every((e) => e.reason instanceof IndyVdrNotFoundError)
      const rejectedOtherThanNotFound = rejected.filter((e) => !(e.reason instanceof IndyVdrNotFoundError))

      // All ledgers returned response that the did was not found
      if (allNotFound) {
        throw new IndyVdrNotFoundError(`Did '${did}' not found on any of the ledgers (total ${this.pools.length}).`)
      }

      // one or more of the ledgers returned an unknown error
      throw new IndyVdrError(
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers. ${rejectedOtherThanNotFound[0].reason}`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // IndyVdrModuleConfigOptions.networks config as the order of preference of ledgers
    let value = successful.find((response) =>
      isSelfCertifiedDid(response.value.did.nymResponse.did, response.value.did.nymResponse.verkey)
    )?.value

    if (!value) {
      // Split between production and nonProduction ledgers. If there is at least one
      // successful response from a production ledger, only keep production ledgers
      // otherwise we only keep the non production ledgers.
      const production = successful.filter((s) => s.value.pool.config.isProduction)
      const nonProduction = successful.filter((s) => !s.value.pool.config.isProduction)
      const productionOrNonProduction = production.length >= 1 ? production : nonProduction

      // We take the first value as we take the order in the IndyVdrModuleConfigOptions.networks
      // config as the order of preference of ledgers
      value = productionOrNonProduction[0].value
    }

    await cache.set(agentContext, cacheKey, {
      nymResponse: {
        did: value.did.nymResponse.did,
        verkey: value.did.nymResponse.verkey,
      },
      indyNamespace: value.did.indyNamespace,
    })
    return { pool: value.pool, nymResponse: value.did.nymResponse }
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
   * Refresh the pool connections asynchronously
   */
  public refreshPoolConnections() {
    return Promise.allSettled(this.pools.map((pool) => pool.refreshConnection()))
  }

  /**
   * Get all pool transactions
   */
  public getAllPoolTransactions() {
    return Promise.allSettled(
      this.pools.map(async (pool) => {
        return { config: pool.config, transactions: await pool.transactions }
      })
    )
  }

  /**
   * Get the most appropriate pool for the given indyNamespace
   */
  public getPoolForNamespace(indyNamespace: string) {
    if (this.pools.length === 0) {
      throw new IndyVdrNotConfiguredError(
        'No indy ledgers configured. Provide at least one pool configuration in IndyVdrModuleConfigOptions.networks'
      )
    }

    const pool = this.pools.find((pool) => pool.indyNamespace === indyNamespace)

    if (!pool) {
      throw new IndyVdrError(`No ledgers found for indy namespace '${indyNamespace}'.`)
    }

    return pool
  }

  private async getDidFromPool(did: string, pool: IndyVdrPool): Promise<PublicDidRequest> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.indyNamespace}'`)
      const request = new GetNymRequest({ dest: did })

      this.logger.trace(`Submitting get did request for did '${did}' to ledger '${pool.indyNamespace}'`)
      const response = await pool.submitRequest(request)

      if (!response.result.data) {
        throw new IndyVdrNotFoundError(`Did ${did} not found on indy pool with namespace ${pool.indyNamespace}`)
      }

      const result = JSON.parse(response.result.data)

      this.logger.trace(`Retrieved did '${did}' from ledger '${pool.indyNamespace}'`, result)

      return {
        did: { nymResponse: { did: result.dest, verkey: result.verkey }, indyNamespace: pool.indyNamespace },
        pool,
        response,
      }
    } catch (error) {
      this.logger.trace(`Error retrieving did '${did}' from ledger '${pool.indyNamespace}'`, {
        error,
        did,
      })
      throw error
    }
  }
}

export interface PublicDidRequest {
  did: CachedDidResponse
  pool: IndyVdrPool
  response: GetNymResponse
}
