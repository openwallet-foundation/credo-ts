import type { NextFunction, Response, Router } from 'express'
import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VcIssuanceRequest } from './requestContext'

/**
 * Challenge endpoint for the Client Attestation PoP `challenge` (draft 09 of OAuth 2.0
 * Attestation-Based Client Authentication). Returns a fresh challenge to be included in the
 * `challenge` claim of a Client Attestation PoP JWT.
 */
export function configureClientAttestationChallengeEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(
    config.clientAttestationChallengeEndpointPath,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext

      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const { challenge } = await openId4VcIssuerService.createClientAttestationChallenge(agentContext, issuer)

        return sendJsonResponse(response, next, { attestation_challenge: challenge })
      } catch (error) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
