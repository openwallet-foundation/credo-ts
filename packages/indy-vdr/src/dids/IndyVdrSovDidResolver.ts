import type { AgentContext, DidResolutionResult, DidResolver, ParsedDid } from '@credo-ts/core'
import { GetAttribRequest, GetNymRequest } from '@hyperledger/indy-vdr-shared'
import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import type { IndyVdrPool } from '../pool'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'
import type { GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './didSovUtil'

export class IndyVdrSovDidResolver implements DidResolver {
  public readonly supportedMethods = ['sov']

  public readonly allowsCaching = true

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      // FIXME: this actually fetches the did twice (if not cached), once for the pool and once for the nym
      // we do not store the diddocContent in the pool cache currently so we need to fetch it again
      // The logic is mostly to determine which pool to use for a did
      const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, parsed.id)
      const nym = await this.getPublicDid(pool, parsed.id)
      const endpoints = await this.getEndpointsForDid(agentContext, pool, parsed.id)

      const keyAgreementId = `${parsed.did}#key-agreement-1`
      const builder = sovDidDocumentFromDid(parsed.did, nym.verkey)

      if (endpoints) {
        addServicesFromEndpointsAttrib(builder, parsed.did, endpoints, keyAgreementId)
      }

      return {
        didDocument: builder.build(),
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }

  private async getPublicDid(pool: IndyVdrPool, unqualifiedDid: string) {
    const request = new GetNymRequest({ dest: unqualifiedDid })
    const didResponse = await pool.submitRequest(request)

    if (!didResponse.result.data) {
      throw new IndyVdrNotFoundError(`DID ${unqualifiedDid} not found`)
    }
    return JSON.parse(didResponse.result.data) as GetNymResponseData
  }

  private async getEndpointsForDid(agentContext: AgentContext, pool: IndyVdrPool, did: string) {
    try {
      agentContext.config.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.indyNamespace}'`)

      const request = new GetAttribRequest({ targetDid: did, raw: 'endpoint' })

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitRequest(request)

      if (!response.result.data) {
        return null
      }

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints ?? null
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving endpoints for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
          error,
        }
      )

      throw new IndyVdrError(error)
    }
  }
}
