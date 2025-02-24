import type { OpenId4VcVerificationRequest } from './requestContext'
import type { Response, Router } from 'express'

import { Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'

import { getRequestContext, sendErrorResponse, sendJsonResponse, sendOauth2ErrorResponse } from '../../shared/router'
import { OpenId4VcSiopVerifierService } from '../OpenId4VcSiopVerifierService'

export interface OpenId4VcSiopAuthorizationEndpointConfig {
  /**
   * The path at which the authorization endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and verifiers.
   *
   * @default /authorize
   */
  endpointPath: string
}

export function configureAuthorizationEndpoint(router: Router, config: OpenId4VcSiopAuthorizationEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcVerificationRequest, response: Response, next) => {
    const { agentContext, verifier } = getRequestContext(request)

    try {
      const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)

      const result = await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, {
        authorizationResponse: request.body,
        verifierId: verifier.verifierId,
      })

      return sendJsonResponse(response, next, {
        // Used only for presentation during issuance flow, to prevent session fixation.
        presentation_during_issuance_session: result.verificationSession.presentationDuringIssuanceSession,
      })
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }

      return sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', error)
    }
  })
}
