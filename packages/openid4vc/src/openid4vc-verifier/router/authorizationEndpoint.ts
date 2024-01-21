import type { OpenId4VcVerificationRequest } from './requestContext'
import type { AuthorizationResponsePayload } from '@sphereon/did-auth-siop'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcVerifierService } from '../OpenId4VcVerifierService'

export interface AuthorizationEndpointConfig {
  /**
   * The path at which the authorization endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and verifiers.
   *
   * @default /authorize
   */
  endpointPath: string
}

export function configureAuthorizationEndpoint(router: Router, config: AuthorizationEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcVerificationRequest, response: Response) => {
    const { agentContext } = getRequestContext(request)

    try {
      const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcVerifierService)
      const isVpRequest = request.body.presentation_submission !== undefined

      // FIXME: body should be verified
      const authorizationResponse: AuthorizationResponsePayload = request.body
      if (isVpRequest) authorizationResponse.presentation_submission = JSON.parse(request.body.presentation_submission)

      await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, request.body)
      return response.status(200).send()
    } catch (error) {
      return sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }
  })
}
