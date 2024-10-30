import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VciCredentialRequest } from '../../shared'
import type { OpenId4VciCredentialRequestToCredentialMapper } from '../OpenId4VcIssuerServiceOptions'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse, sendJsonResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { getCNonceFromCredentialRequest } from '../util/credentialRequest'

import { verifyResourceRequest } from '../authorization/verifyResourceRequest'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { utils } from '@credo-ts/core'

export interface OpenId4VciCredentialEndpointConfig {
  /**
   * The path at which the credential endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /credential
   */
  endpointPath: string

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper
}

export function configureCredentialEndpoint(router: Router, config: OpenId4VciCredentialEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuanceModuleConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

    // Verify the access token (should at some point be moved to a middleware function or something)
    const verifyAccessTokenResult = await verifyResourceRequest(agentContext, issuer, request).catch((error) => {
      sendErrorResponse(response, next, agentContext.config.logger, 401, 'unauthorized', error)
    })
    if (!verifyAccessTokenResult) return

    try {
      const credentialRequest = request.body
      const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

      let issuanceSession: OpenId4VcIssuanceSessionRecord | null
      if ('preAuthorizedCode' in verifyAccessTokenResult) {
        issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
          issuerId: issuer.issuerId,
          preAuthorizedCode: verifyAccessTokenResult.preAuthorizedCode,
        })
      } else {
        issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
          issuerId: issuer.issuerId,
          issuerState: verifyAccessTokenResult.issuerState,
        })
      }

      if (!issuanceSession) {
        agentContext.config.logger.warn(
          `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
          {
            verifyAccessTokenResult,
          }
        )
        return sendErrorResponse(response, next, agentContext.config.logger, 404, 'invalid_request', null)
      }

      try {
        const cNonce = getCNonceFromCredentialRequest(credentialRequest)

        if (!issuanceSession.cNonce || cNonce !== issuanceSession.cNonce) {
          throw new Error('Invalid c_nonce')
        }
      } catch (error) {
        // If no c_nonce could be extracted we generate a new one and send that in the error response
        const expiresAtDate = new Date(
          Date.now() + issuanceModuleConfig.accessTokenEndpoint.cNonceExpiresInSeconds * 1000
        )

        issuanceSession.cNonce = utils.uuid()
        issuanceSession.cNonceExpiresAt = expiresAtDate
        issuanceSessionRepository.update(agentContext, issuanceSession)

        return sendErrorResponse(response, next, agentContext.config.logger, 404, 'invalid_proof', null, {
          c_nonce: issuanceSession.cNonce,
          c_nonce_expires_in: issuanceModuleConfig.accessTokenEndpoint.cNonceExpiresInSeconds,
        })
      }

      // TODO: invalidate nonce if this method fails
      const { credentialResponse } = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuanceSession,
        credentialRequest,
      })

      return sendJsonResponse(response, next, credentialResponse)
    } catch (error) {
      return sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', error)
    }
  })
}
