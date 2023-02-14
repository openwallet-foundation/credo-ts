import type { GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'
import type { DidResolutionResult, ParsedDid, DidResolver, AgentContext } from '@aries-framework/core'

import { GetAttribRequest, GetNymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './didSovUtil'

export class IndyVdrSovDidResolver implements DidResolver {
  public readonly supportedMethods = ['sov']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const nym = await this.getPublicDid(agentContext, parsed.id)
      const builder = sovDidDocumentFromDid(parsed.did, nym.verkey)

      const endpoints = await this.getEndpointsForDid(agentContext, parsed.id)

      if (endpoints) {
        const keyAgreementId = `${parsed.did}#key-agreement-1`

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

  private async getPublicDid(agentContext: AgentContext, did: string) {
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    const pool = await indyVdrPoolService.getPoolForDid(agentContext, did)

    const request = new GetNymRequest({ dest: did })

    const didResponse = await pool.submitReadRequest(request)

    if (!didResponse.result.data) {
      throw new IndyVdrNotFoundError(`DID ${did} not found`)
    }
    return JSON.parse(didResponse.result.data) as GetNymResponseData
  }

  private async getEndpointsForDid(agentContext: AgentContext, did: string) {
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    const pool = await indyVdrPoolService.getPoolForDid(agentContext, did)

    try {
      agentContext.config.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.indyNamespace}'`)

      const request = new GetAttribRequest({ targetDid: did, raw: 'endpoint' })

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitReadRequest(request)

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
