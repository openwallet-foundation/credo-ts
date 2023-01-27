import type { GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'
import type { DidResolutionResult, ParsedDid, DidResolver, AgentContext } from '@aries-framework/core'

import { injectable } from '@aries-framework/core'
import { GetAttribRequest, GetNymRequest } from 'indy-vdr-test-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'

import { indyDidDocumentFromDid, addServicesFromEndpointsAttrib } from './didSovUtil'

@injectable()
export class IndyVdrIndyDidResolver implements DidResolver {
  private indyVdrPoolService: IndyVdrPoolService

  public constructor(indyVdrPoolService: IndyVdrPoolService) {
    this.indyVdrPoolService = indyVdrPoolService
  }

  public readonly supportedMethods = ['indy']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const nym = await this.getPublicDid(agentContext, did)

      // Get DID Document from Get NYM response or fallback re-build it if not present
      const didDocument = await this.buildDidDocument(agentContext, nym, parsed)

      return {
        didDocument,
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

  // did:indy uses indyDidDocumentFromDid while did:sov uses sovDidDocumentFromDid
  private async buildDidDocument(agentContext: AgentContext, nym: GetNymResponseData, parsed: ParsedDid) {
    if (!nym.diddocContent) {
      const endpoints = await this.getEndpointsForDid(agentContext, parsed.id)

      const keyAgreementId = `${parsed.did}#key-agreement-1`
      const builder = indyDidDocumentFromDid(parsed.did, nym.verkey)
      addServicesFromEndpointsAttrib(builder, parsed.did, endpoints, keyAgreementId)
      return builder.build()
    } else {
      // Create base Did Document
      const builder = indyDidDocumentFromDid(parsed.did, nym.verkey)

      // Combine it with didDoc
      return builder.build().combine(JSON.parse(nym.diddocContent))
    }
  }

  private async getPublicDid(agentContext: AgentContext, did: string) {
    const pool = await this.indyVdrPoolService.getPoolForDid(agentContext, did)

    const request = new GetNymRequest({ dest: did })

    const didResponse = await pool.submitReadRequest(request)

    if (!didResponse.result.data) {
      throw new IndyVdrNotFoundError(`DID ${did} not found`)
    }
    return JSON.parse(didResponse.result.data) as GetNymResponseData
  }

  private async getEndpointsForDid(agentContext: AgentContext, did: string) {
    const pool = await this.indyVdrPoolService.getPoolForDid(agentContext, did)

    try {
      agentContext.config.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.indyNamespace}'`)

      const request = new GetAttribRequest({ targetDid: did, raw: 'endpoint' })

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) return {}

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints ?? {}
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
