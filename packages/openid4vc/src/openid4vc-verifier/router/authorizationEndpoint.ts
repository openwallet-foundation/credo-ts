import type { OpenId4VcVerificationRequest } from './requestContext'
import type { AuthorizationResponsePayload } from '@sphereon/did-auth-siop'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
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
      const isVpRequest = request.body.presentation_submission !== undefined

      const authorizationResponse: AuthorizationResponsePayload = request.body
      if (isVpRequest) authorizationResponse.presentation_submission = JSON.parse(request.body.presentation_submission)

      // FIXME: we should emit an event here and in other places
      await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, {
        authorizationResponse: request.body,
        verifier,
      })
      response.status(200).send()
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
