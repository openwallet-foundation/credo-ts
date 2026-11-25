import type { Response, Router } from 'express'
import { getAccessTokenJwks } from '../../shared/localJwks'
import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureJwksEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(config.jwksEndpointPath, async (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(_request)
    try {
      return sendJsonResponse(response, next, getAccessTokenJwks(issuer), 'application/jwk-set+json')
    } catch (e) {
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
    }
  })
}
