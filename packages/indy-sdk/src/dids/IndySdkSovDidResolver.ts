import type { IndyEndpointAttrib } from './didSovUtil'
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
      const nym = await this.getPublicDid(agentContext, parsed.id)
      const endpoints = await this.getEndpointsForDid(agentContext, parsed.id)

      const keyAgreementId = `${parsed.did}#key-agreement-1`
      const builder = sovDidDocumentFromDid(parsed.did, nym.verkey)
      addServicesFromEndpointsAttrib(builder, parsed.did, endpoints, keyAgreementId)

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

  private async getPublicDid(agentContext: AgentContext, did: string) {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    // Getting the pool for a did also retrieves the DID. We can just use that
    const { did: didResponse } = await indySdkPoolService.getPoolForDid(agentContext, did)

    return didResponse
  }

  private async getEndpointsForDid(agentContext: AgentContext, did: string) {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

    try {
      agentContext.config.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.didIndyNamespace}'`)

      const request = await indySdk.buildGetAttribRequest(null, did, 'endpoint', null, null)

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.didIndyNamespace}'`
      )
      const response = await indySdkPoolService.submitReadRequest(pool, request)

      if (!response.result.data) return {}

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.didIndyNamespace}'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints ?? {}
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving endpoints for did '${did}' from ledger '${pool.didIndyNamespace}'`,
        {
          error,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
