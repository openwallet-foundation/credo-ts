import type { AcceptanceMechanisms, AuthorAgreement } from './IndySdkPool'
import type { IndySdk } from '../types'
import type { AgentContext, Key } from '@aries-framework/core'
import type { GetNymResponse, LedgerReadReplyResponse, LedgerRequest, LedgerWriteReplyResponse } from 'indy-sdk'

import {
  TypedArrayEncoder,
  CacheModuleConfig,
  InjectionSymbols,
  Logger,
  injectable,
  inject,
  FileSystem,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { IndySdkModuleConfig } from '../IndySdkModuleConfig'
import { IndySdkError, isIndyError } from '../error'
import { assertIndySdkWallet } from '../utils/assertIndySdkWallet'
import { DID_INDY_REGEX, isLegacySelfCertifiedDid } from '../utils/did'
import { allSettled, onlyFulfilled, onlyRejected } from '../utils/promises'

import { IndySdkPool } from './IndySdkPool'
import { IndySdkPoolError, IndySdkPoolNotConfiguredError, IndySdkPoolNotFoundError } from './error'
import { serializeRequestForSignature } from './serializeRequestForSignature'

export interface CachedDidResponse {
  nymResponse: GetNymResponse
  indyNamespace: string
}

@injectable()
export class IndySdkPoolService {
  public pools: IndySdkPool[] = []
  private logger: Logger
  private indySdk: IndySdk
  private stop$: Subject<boolean>
  private fileSystem: FileSystem
  private indySdkModuleConfig: IndySdkModuleConfig

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem,
    indySdkModuleConfig: IndySdkModuleConfig
  ) {
    this.logger = logger
    this.indySdk = indySdkModuleConfig.indySdk
    this.fileSystem = fileSystem
    this.stop$ = stop$
    this.indySdkModuleConfig = indySdkModuleConfig

    this.pools = this.indySdkModuleConfig.networks.map(
      (network) => new IndySdkPool(network, this.indySdk, this.logger, this.stop$, this.fileSystem)
    )
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
  ): Promise<{ pool: IndySdkPool; nymResponse?: GetNymResponse }> {
    // Check if the did starts with did:indy
    const match = did.match(DID_INDY_REGEX)

    if (match) {
      const [, namespace] = match

      const pool = this.getPoolForNamespace(namespace)

      if (pool) return { pool }

      throw new IndySdkPoolError(`Pool for indy namespace '${namespace}' not found`)
    } else {
      return await this.getPoolForLegacyDid(agentContext, did)
    }
  }

  private async getPoolForLegacyDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: IndySdkPool; nymResponse: GetNymResponse }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new IndySdkPoolNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
    const cachedNymResponse = await cache.get<CachedDidResponse>(agentContext, `IndySdkPoolService:${did}`)
    const pool = this.pools.find((pool) => pool.didIndyNamespace === cachedNymResponse?.indyNamespace)

    // If we have the nym response with associated pool in the cache, we'll use that
    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger '${pool.didIndyNamespace}' for did '${did}' in cache`)
      return { nymResponse: cachedNymResponse.nymResponse, pool }
    }

    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    if (successful.length === 0) {
      const allNotFound = rejected.every((e) => e.reason instanceof IndySdkPoolNotFoundError)
      const rejectedOtherThanNotFound = rejected.filter((e) => !(e.reason instanceof IndySdkPoolNotFoundError))

      // All ledgers returned response that the did was not found
      if (allNotFound) {
        throw new IndySdkPoolNotFoundError(`Did '${did}' not found on any of the ledgers (total ${this.pools.length}).`)
      }

      // one or more of the ledgers returned an unknown error
      throw new IndySdkPoolError(
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers. ${rejectedOtherThanNotFound[0].reason}`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // indyLedgers config as the order of preference of ledgers
    let value = successful.find((response) =>
      isLegacySelfCertifiedDid(response.value.did.did, response.value.did.verkey)
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

    await cache.set(agentContext, `IndySdkPoolService:${did}`, {
      nymResponse: value.did,
      indyNamespace: value.pool.didIndyNamespace,
    } satisfies CachedDidResponse)

    return { pool: value.pool, nymResponse: value.did }
  }

  private async getSettledDidResponsesFromPools(did: string, pools: IndySdkPool[]) {
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
      throw new IndySdkPoolNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    if (!indyNamespace) {
      this.logger.warn('Not passing the indyNamespace is deprecated and will be removed in the future version.')
      return this.pools[0]
    }

    const pool = this.pools.find((pool) => pool.didIndyNamespace === indyNamespace)

    if (!pool) {
      throw new IndySdkPoolNotFoundError(`No ledgers found for indy namespace '${indyNamespace}'.`)
    }

    return pool
  }

  public async submitWriteRequest(
    agentContext: AgentContext,
    pool: IndySdkPool,
    request: LedgerRequest,
    signingKey: Key
  ): Promise<LedgerWriteReplyResponse> {
    try {
      const requestWithTaa = await this.appendTaa(pool, request)
      const signedRequestWithTaa = await this.signRequest(agentContext, signingKey, requestWithTaa)

      const response = await pool.submitWriteRequest(signedRequestWithTaa)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async submitReadRequest(pool: IndySdkPool, request: LedgerRequest): Promise<LedgerReadReplyResponse> {
    try {
      const response = await pool.submitReadRequest(request)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async signRequest(agentContext: AgentContext, key: Key, request: LedgerRequest): Promise<LedgerRequest> {
    assertIndySdkWallet(agentContext.wallet)

    try {
      const signedPayload = await this.indySdk.cryptoSign(
        agentContext.wallet.handle,
        key.publicKeyBase58,
        TypedArrayEncoder.fromString(serializeRequestForSignature(request))
      )

      const signedRequest = { ...request, signature: TypedArrayEncoder.toBase58(signedPayload) }
      return signedRequest
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async appendTaa(pool: IndySdkPool, request: LedgerRequest) {
    try {
      const authorAgreement = await this.getTransactionAuthorAgreement(pool)
      const taa = pool.config.transactionAuthorAgreement

      // If ledger does not have TAA, we can just send request
      if (authorAgreement == null) {
        return request
      }
      // Ledger has taa but user has not specified which one to use
      if (!taa) {
        throw new IndySdkPoolError(
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
        throw new IndySdkPoolError(errMessage)
      }

      const requestWithTaa = await this.indySdk.appendTxnAuthorAgreementAcceptanceToRequest(
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

  private async getTransactionAuthorAgreement(pool: IndySdkPool): Promise<AuthorAgreement | null> {
    try {
      // TODO Replace this condition with memoization
      if (pool.authorAgreement !== undefined) {
        return pool.authorAgreement
      }

      const taaRequest = await this.indySdk.buildGetTxnAuthorAgreementRequest(null)
      const taaResponse = await this.submitReadRequest(pool, taaRequest)
      const acceptanceMechanismRequest = await this.indySdk.buildGetAcceptanceMechanismsRequest(null)
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

  private async getDidFromPool(did: string, pool: IndySdkPool): Promise<PublicDidRequest> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.didIndyNamespace}'`)
      const request = await this.indySdk.buildGetNymRequest(null, did)

      this.logger.trace(`Submitting get did request for did '${did}' to ledger '${pool.didIndyNamespace}'`)
      const response = await pool.submitReadRequest(request)

      const result = await this.indySdk.parseGetNymResponse(response)
      this.logger.trace(`Retrieved did '${did}' from ledger '${pool.didIndyNamespace}'`, result)

      return {
        did: result,
        pool,
        response,
      }
    } catch (error) {
      this.logger.trace(`Error retrieving did '${did}' from ledger '${pool.didIndyNamespace}'`, {
        error,
        did,
      })
      if (isIndyError(error, 'LedgerNotFound')) {
        throw new IndySdkPoolNotFoundError(`Did '${did}' not found on ledger ${pool.didIndyNamespace}`)
      } else {
        throw isIndyError(error) ? new IndySdkError(error) : error
      }
    }
  }
}

export interface PublicDidRequest {
  did: GetNymResponse
  pool: IndySdkPool
  response: LedgerReadReplyResponse
}
