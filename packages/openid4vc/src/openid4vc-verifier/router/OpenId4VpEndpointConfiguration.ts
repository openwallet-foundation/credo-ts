import type { OpenId4VcVerifierService } from '../OpenId4VcVerifierService'
import type { VerificationEndpointConfig } from '../OpenId4VcVerifierServiceOptions'
import type { AgentContext, Logger } from '@aries-framework/core'
import type { AuthorizationResponsePayload } from '@sphereon/did-auth-siop'
import type { Router, Request } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'

export interface VerificationRequestContext {
  agentContext: AgentContext
  openId4VcVerifierService: OpenId4VcVerifierService
  logger: Logger
}

export interface VerificationRequest extends Request {
  requestContext?: VerificationRequestContext
}

export type InternalVerificationEndpointConfig = VerificationEndpointConfig

export const configureVerificationEndpoint = (
  router: Router,
  pathname: string,
  config: InternalVerificationEndpointConfig
) => {
  router.post(pathname, async (request: VerificationRequest, response) => {
    const { logger, agentContext, openId4VcVerifierService } = getRequestContext(request)
    try {
      const isVpRequest = request.body.presentation_submission !== undefined

      const authorizationResponse: AuthorizationResponsePayload = request.body
      if (isVpRequest) authorizationResponse.presentation_submission = JSON.parse(request.body.presentation_submission)

      const verifiedProofResponse = await openId4VcVerifierService.verifyProofResponse(agentContext, request.body)
      if (!config.proofResponseHandler) return response.status(200).send()

      const { status } = await config.proofResponseHandler(verifiedProofResponse)
      return response.status(status).send()
    } catch (error: unknown) {
      sendErrorResponse(response, logger, 500, 'invalid_request', error)
    }

    return response.status(200).send()
  })

  return router
}
