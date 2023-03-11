import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndySdkPool } from '../ledger'
import type { IndySdk } from '../types'
import type { DidResolutionResult, DidResolver, AgentContext } from '@aries-framework/core'

import { isIndyError, IndySdkError } from '../error'
import { IndySdkPoolService } from '../ledger/IndySdkPoolService'
import { IndySdkSymbol } from '../types'
import { getFullVerkey } from '../utils/did'

import { createKeyAgreementKey, indyDidDocumentFromDid, parseIndyDid } from './didIndyUtil'
import { addServicesFromEndpointsAttrib } from './didSovUtil'

export class IndySdkIndyDidResolver implements DidResolver {
  public readonly supportedMethods = ['indy']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const { namespaceIdentifier, namespace } = parseIndyDid(did)

      const poolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const pool = poolService.getPoolForNamespace(namespace)

      const nym = await this.getPublicDid(agentContext, pool, namespaceIdentifier)
      const endpoints = await this.getEndpointsForDid(agentContext, pool, namespaceIdentifier)

      // For modern did:indy DIDs, we assume that GET_NYM is always a full verkey in base58.
      // For backwards compatibility, we accept a shortened verkey and convert it using previous convention
      const verkey = getFullVerkey(did, nym.verkey)
      const builder = indyDidDocumentFromDid(did, verkey)

      // NOTE: we don't support the `diddocContent` field in the GET_NYM response using the indy-sdk. So if the did would have the `diddocContent` field
      // we will ignore it without knowing if it is present. We may be able to extract the diddocContent from the GET_NYM response in the future, but need
      // some dids registered with diddocContent to test with.
      if (endpoints) {
        const keyAgreementId = `${did}#key-agreement-1`

        builder
          .addContext('https://w3id.org/security/suites/x25519-2019/v1')
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(verkey),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)
        addServicesFromEndpointsAttrib(builder, did, endpoints, keyAgreementId)
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

  private async getPublicDid(agentContext: AgentContext, pool: IndySdkPool, unqualifiedDid: string) {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

    const request = await indySdk.buildGetNymRequest(null, unqualifiedDid)
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

      if (!response.result.data) {
        return null
      }

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

      return endpoints
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
