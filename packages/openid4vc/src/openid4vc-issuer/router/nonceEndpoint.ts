import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { NextFunction, Response, Router } from 'express'

import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export interface OpenId4VciNonceEndpointConfig {
  /**
   * The path at which the nonce endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /nonce
   */
  endpointPath: string

  /**
   * The time after which the cNonce from the nonce response will
   * expire.
   *
   * @default 60 (1 minute)
   */
  cNonceExpiresInSeconds: number
}

export function configureNonceEndpoint(router: Router, config: OpenId4VciNonceEndpointConfig) {
  router.post(
    config.endpointPath,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext

      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const vcIssuer = openId4VcIssuerService.getIssuer(agentContext, issuer)

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
