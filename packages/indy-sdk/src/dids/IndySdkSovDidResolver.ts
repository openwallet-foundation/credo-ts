import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndySdkPool } from '../ledger'
import type { IndySdk } from '../types'
import type { DidResolutionResult, ParsedDid, DidResolver, AgentContext } from '@aries-framework/core'

import { isIndyError, IndySdkError } from '../error'
import { IndySdkPoolService } from '../ledger/IndySdkPoolService'
import { IndySdkSymbol } from '../types'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './didSovUtil'

export class IndySdkSovDidResolver implements DidResolver {
  public readonly supportedMethods = ['sov']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const poolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const { pool, nymResponse } = await poolService.getPoolForDid(agentContext, parsed.id)
      const nym = nymResponse ?? (await this.getPublicDid(agentContext, pool, parsed.id))
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

  private async getPublicDid(agentContext: AgentContext, pool: IndySdkPool, did: string) {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

    const request = await indySdk.buildGetNymRequest(null, did)
    const response = await indySdkPoolService.submitReadRequest(pool, request)

    return await indySdk.parseGetNymResponse(response)
  }

  private async getEndpointsForDid(agentContext: AgentContext, pool: IndySdkPool, unqualifiedDid: string) {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    try {
      agentContext.config.logger.debug(
        `Get endpoints for did '${unqualifiedDid}' from ledger '${pool.didIndyNamespace}'`
      )

      const request = await indySdk.buildGetAttribRequest(null, unqualifiedDid, 'endpoint', null, null)

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${unqualifiedDid}' to ledger '${pool.didIndyNamespace}'`
      )
      const response = await indySdkPoolService.submitReadRequest(pool, request)

      if (!response.result.data) return null

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${unqualifiedDid}' from ledger '${
          pool.didIndyNamespace
        }'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints ?? null
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving endpoints for did '${unqualifiedDid}' from ledger '${pool.didIndyNamespace}'`,
        {
          error,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
