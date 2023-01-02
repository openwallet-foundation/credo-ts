import type { AgentContext } from '../../../../agent'
import type { IndyEndpointAttrib } from '../../../ledger'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult, ParsedDid } from '../../types'

import { IndySdkError } from '../../../../error'
import { injectable } from '../../../../plugins'
import { isIndyError } from '../../../../utils/indyError'
import { IndyPoolService } from '../../../ledger'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './util'

@injectable()
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
    const indyPoolService = agentContext.dependencyManager.resolve(IndyPoolService)

    // Getting the pool for a did also retrieves the DID. We can just use that
    const { did: didResponse } = await indyPoolService.getPoolForDid(agentContext, did)

    return didResponse
  }

  private async getEndpointsForDid(agentContext: AgentContext, did: string) {
    const indyPoolService = agentContext.dependencyManager.resolve(IndyPoolService)
    const indy = agentContext.config.agentDependencies.indy

    const { pool } = await indyPoolService.getPoolForDid(agentContext, did)

    try {
      agentContext.config.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.id}'`)

      const request = await indy.buildGetAttribRequest(null, did, 'endpoint', null, null)

      agentContext.config.logger.debug(`Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.id}'`)
      const response = await indyPoolService.submitReadRequest(pool, request)

      if (!response.result.data) return {}

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.id}'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints ?? {}
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving endpoints for did '${did}' from ledger '${pool.id}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
