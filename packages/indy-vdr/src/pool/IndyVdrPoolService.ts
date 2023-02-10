import type { AgentContext } from '@aries-framework/core'
import type { GetNymResponse } from '@hyperledger/indy-vdr-shared'

import { Logger, InjectionSymbols, injectable, inject, CacheModuleConfig } from '@aries-framework/core'
import { GetNymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'
import { IndyVdrError, IndyVdrNotFoundError, IndyVdrNotConfiguredError } from '../error'
import { isSelfCertifiedDid, DID_INDY_REGEX } from '../utils/did'
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

    this.pools = this.indyVdrModuleConfig.networks.map((poolConfig) => new IndyVdrPool(poolConfig, this.logger))
  }

  /**
   * Create connections to all ledger pools
   */
  public async connectToPools() {
    const handleArray: number[] = []
    // Sequentially connect to pools so we don't use up too many resources connecting in parallel
    for (const pool of this.pools) {
      this.logger.debug(`Connecting to pool: ${pool.indyNamespace}`)
      const poolHandle = await pool.connect()
      this.logger.debug(`Finished connection to pool: ${pool.indyNamespace}`)
      handleArray.push(poolHandle)
    }
    return handleArray
  }

  /**
   * Get the most appropriate pool for the given did.
   * If the did is a qualified indy did, the pool will be determined based on the namespace.
   * If it is a legacy unqualified indy did, the pool will be determined based on the algorithm as described in this document:
   * https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA/edit
   */
  public async getPoolForDid(agentContext: AgentContext, did: string): Promise<IndyVdrPool> {
    // Check if the did starts with did:indy
    const match = did.match(DID_INDY_REGEX)

    if (match) {
      const [, namespace] = match

      const pool = this.getPoolForNamespace(namespace)

      if (pool) return pool

      throw new IndyVdrError(`Pool for indy namespace '${namespace}' not found`)
    } else {
      return await this.getPoolForLegacyDid(agentContext, did)
    }
  }

  private async getPoolForLegacyDid(agentContext: AgentContext, did: string): Promise<IndyVdrPool> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new IndyVdrNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const didCache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

    const cachedNymResponse = await didCache.get<CachedDidResponse>(agentContext, `IndyVdrPoolService:${did}`)
    const pool = this.pools.find((pool) => pool.indyNamespace === cachedNymResponse?.indyNamespace)

    // If we have the nym response with associated pool in the cache, we'll use that
    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.indyNamespace}' for did '${did}' in cache`)
      return pool
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
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // indyLedgers config as the order of preference of ledgers
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

      // We take the first value as we take the order in the indyLedgers config as
      // the order of preference of ledgers
      value = productionOrNonProduction[0].value
    }

    await didCache.set(agentContext, did, {
      nymResponse: {
        did: value.did.nymResponse.did,
        verkey: value.did.nymResponse.verkey,
      },
      indyNamespace: value.did.indyNamespace,
    })
    return value.pool
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
      throw new IndyVdrNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const pool = this.pools.find((pool) => pool.indyNamespace === indyNamespace)

    if (!pool) {
      throw new IndyVdrError(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }

  private async getDidFromPool(did: string, pool: IndyVdrPool): Promise<PublicDidRequest> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.indyNamespace}'`)
      const request = await new GetNymRequest({ dest: did })

      this.logger.trace(`Submitting get did request for did '${did}' to ledger '${pool.indyNamespace}'`)
      const response = await pool.submitReadRequest(request)

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
