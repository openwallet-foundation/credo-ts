import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { NextFunction, Response, Router } from 'express'

import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureNonceEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(
    config.nonceEndpointPath,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext

      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)

        const { cNonce, cNonceExpiresInSeconds } = await openId4VcIssuerService.createNonce(agentContext, issuer)

        const nonceResponse = vcIssuer.createNonceResponse({
          cNonce,
          cNonceExpiresIn: cNonceExpiresInSeconds,
        })

        return sendJsonResponse(response, next, nonceResponse)
      } catch (error) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
