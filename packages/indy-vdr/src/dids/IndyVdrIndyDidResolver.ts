import type { CommEndpointType, GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'
import type { DidResolutionResult, DidResolver, AgentContext } from '@aries-framework/core'

import { GetAttribRequest, GetNymRequest } from 'indy-vdr-test-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'
import { DID_INDY_REGEX } from '../utils/did'

import { createKeyAgreementKey, indyDidDocumentFromDid } from './didIndyUtil'
import { addServicesFromEndpointsAttrib } from './didSovUtil'

export class IndyVdrIndyDidResolver implements DidResolver {
  public readonly supportedMethods = ['indy']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}
    try {
      const match = did.match(DID_INDY_REGEX)

      if (match) {
        const [, namespace, id] = match

        const nym = await this.getPublicDid(agentContext, namespace, id)

        // Get DID Document from Get NYM response
        const didDocument = await this.buildDidDocument(agentContext, nym, did)

        return {
          didDocument,
          didDocumentMetadata,
          didResolutionMetadata: { contentType: 'application/did+ld+json' },
        }
      } else {
        throw new IndyVdrError(`${did} is not a did:indy DID`)
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

  private async buildDidDocument(agentContext: AgentContext, getNymResponseData: GetNymResponseData, did: string) {
    // Create base Did Document
    // We assume that verkey from GET_NYM is always a full verkey in base58
    const builder = indyDidDocumentFromDid(did, getNymResponseData.verkey)

    // If GET_NYM does not return any diddocContent, fallback to legacy GET_ATTRIB endpoint
    if (!getNymResponseData.diddocContent) {
      const keyAgreementId = `${did}#key-agreement-1`

      const endpoints = await this.getEndpointsForDid(agentContext, did)

      // If there is at least a didcomm endpoint, generate and a key agreement key
      const commTypes: CommEndpointType[] = ['endpoint', 'did-communication', 'DIDComm']
      if (commTypes.some((type) => endpoints.types?.includes(type))) {
        builder
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(did, getNymResponseData.verkey),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)
      }

      // Process endpoint attrib following the same rules as for did:sov
      addServicesFromEndpointsAttrib(builder, did, endpoints, keyAgreementId)
      return builder.build()
    } else {
      // Combine it with didDoc
      return builder.build().combine(JSON.parse(getNymResponseData.diddocContent))
    }
  }

  private async getPublicDid(agentContext: AgentContext, namespace: string, id: string) {
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    const pool = indyVdrPoolService.getPoolForNamespace(namespace)

    const request = new GetNymRequest({ dest: id })

    const didResponse = await pool.submitReadRequest(request)

    if (!didResponse.result.data) {
      throw new IndyVdrNotFoundError(`DID ${id} not found in indy namespace ${namespace}`)
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
