import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { VerifyAccessTokenResult } from './verifyResourceRequest'
import type { OpenId4VciCredentialRequest } from '../../shared'
import type { OpenId4VciCredentialRequestToCredentialMapper } from '../OpenId4VcIssuerServiceOptions'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { getCNonceFromCredentialRequest } from '../util/credentialRequest'

import { verifyResourceRequest } from './verifyResourceRequest'

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

    let verifyAccessTokenResult: VerifyAccessTokenResult

    // Verify the access token (should at some point be moved to a middleware function or something)
    try {
      verifyAccessTokenResult = await verifyResourceRequest(agentContext, issuer, request)
    } catch (error) {
      return sendErrorResponse(response, agentContext.config.logger, 401, 'unauthorized', error)
    }

    try {
      const credentialRequest = request.body as OpenId4VciCredentialRequest

      const issuanceSession = await openId4VcIssuerService.findIssuanceSessionForCredentialRequest(agentContext, {
        issuerId: issuer.issuerId,
        credentialRequest,
      })

      if (!issuanceSession) {
        const cNonce = getCNonceFromCredentialRequest(credentialRequest)
        agentContext.config.logger.warn(
          `No issuance session found for incoming credential request with cNonce ${cNonce} and issuer ${issuer.issuerId}`
        )
        return sendErrorResponse(response, agentContext.config.logger, 404, 'invalid_request', null)
      }

      if (
        (verifyAccessTokenResult.preAuthorizedCode &&
          issuanceSession.preAuthorizedCode !== verifyAccessTokenResult.preAuthorizedCode) ||
        (verifyAccessTokenResult.issuerState && issuanceSession.issuerState !== verifyAccessTokenResult.issuerState)
      ) {
        agentContext.config.logger.warn(
          `Credential request used access token with different a pre-authorized code or issuerState code than was used for the issuance session ${issuanceSession?.id}`
        )
        return sendErrorResponse(
          response,
          agentContext.config.logger,
          401,
          'unauthorized',
          'Access token is not valid for this credential request'
        )
      }

      const { credentialResponse } = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuanceSession,
        credentialRequest,
      })

      response.json(credentialResponse)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
