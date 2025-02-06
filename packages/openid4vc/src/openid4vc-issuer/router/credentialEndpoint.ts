import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { Router, Response } from 'express'

import { Oauth2ServerErrorResponseError, Oauth2ResourceUnauthorizedError } from '@animo-id/oauth2'

import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { configureCredentialEndpointHandler } from '../handler/credentialEndpointHandler'

export function configureCredentialEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  const credentialEndpointHandler = configureCredentialEndpointHandler(config)
  router.post(config.credentialEndpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const requestContext = getRequestContext(request)
    try {
      const credentialResponse = await credentialEndpointHandler(request.body, request, requestContext)
      return sendJsonResponse(response, next, credentialResponse)
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, requestContext.agentContext.config.logger, error)
      }
      if (error instanceof Oauth2ResourceUnauthorizedError) {
        return sendUnauthorizedError(response, next, requestContext.agentContext.config.logger, error)
      }

      return sendUnknownServerErrorResponse(response, next, requestContext.agentContext.config.logger, error)
    }
  })
}
