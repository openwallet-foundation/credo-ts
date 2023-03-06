import type { GetNymResponseData, IndyEndpointAttrib } from './didSovUtil'
import type { IndyVdrPool } from '../pool'
import type { DidResolutionResult, DidResolver, AgentContext } from '@aries-framework/core'

import { GetAttribRequest, GetNymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import { IndyVdrPoolService } from '../pool'

import { combineDidDocumentWithJson, createKeyAgreementKey, indyDidDocumentFromDid, parseIndyDid } from './didIndyUtil'
import { getFullVerkey, addServicesFromEndpointsAttrib } from './didSovUtil'

export class IndyVdrIndyDidResolver implements DidResolver {
  public readonly supportedMethods = ['indy']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}
    try {
      // Get DID Document from Get NYM response
      const didDocument = await this.buildDidDocument(agentContext, did)

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

  private async buildDidDocument(agentContext: AgentContext, did: string) {
    const { namespaceIdentifier, namespace } = parseIndyDid(did)

    const poolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)
    const pool = poolService.getPoolForNamespace(namespace)

    const nym = await this.getPublicDid(pool, namespaceIdentifier)

    // Create base Did Document

    // For modern did:indy DIDs, we assume that GET_NYM is always a full verkey in base58.
    // For backwards compatibility, we accept a shortened verkey and convert it using previous convention
    const verkey = getFullVerkey(namespaceIdentifier, nym.verkey)

    const builder = indyDidDocumentFromDid(did, verkey)

    // If GET_NYM does not return any diddocContent, fallback to legacy GET_ATTRIB endpoint
    if (!nym.diddocContent) {
      const keyAgreementId = `${did}#key-agreement-1`
      const endpoints = await this.getEndpointsForDid(agentContext, pool, namespaceIdentifier)

      if (endpoints) {
        builder
          .addContext('https://w3id.org/security/suites/x25519-2019/v1')
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(verkey),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)

        // Process endpoint attrib following the same rules as for did:sov
        addServicesFromEndpointsAttrib(builder, did, endpoints, keyAgreementId)
      }
      return builder.build()
    } else {
      // Combine it with didDoc (TODO: Check if diddocContent is returned as a JSON object or a string)
      return combineDidDocumentWithJson(builder.build(), nym.diddocContent)
    }
  }

  private async getPublicDid(pool: IndyVdrPool, unqualifiedDid: string) {
    const request = new GetNymRequest({ dest: unqualifiedDid })

    const didResponse = await pool.submitReadRequest(request)

    if (!didResponse.result.data) {
      throw new IndyVdrNotFoundError(`DID ${unqualifiedDid} not found in indy namespace ${pool.indyNamespace}`)
    }
    return JSON.parse(didResponse.result.data) as GetNymResponseData
  }

  private async getEndpointsForDid(agentContext: AgentContext, pool: IndyVdrPool, unqualifiedDid: string) {
    try {
      agentContext.config.logger.debug(`Get endpoints for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`)

      const request = new GetAttribRequest({ targetDid: unqualifiedDid, raw: 'endpoint' })

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${unqualifiedDid}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        return null
      }

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(endpoints)}' for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )

      return endpoints
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving endpoints for did '${unqualifiedDid}' from ledger '${pool.indyNamespace}'`,
        {
          error,
        }
      )

      throw new IndyVdrError(error)
    }
  }
}
