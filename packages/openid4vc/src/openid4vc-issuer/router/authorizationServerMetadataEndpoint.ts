import type { Response, Router } from 'express'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { getAuthorizationServerMetadataFromList } from '@openid4vc/oauth2'

import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

/**
 * This is the credo authorization server metadata. It is only used for pre-authorized
 * code flow.
 */
export function configureOAuthAuthorizationServerMetadataEndpoint(router: Router) {
  router.get(
    '/.well-known/oauth-authorization-server',
    async (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(_request)
      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
        const issuerAuthorizationServer = getAuthorizationServerMetadataFromList(
          issuerMetadata.authorizationServers,
          issuerMetadata.credentialIssuer.credential_issuer
        )

        return sendJsonResponse(response, next, issuerAuthorizationServer)
      } catch (e) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
      }
    }
  )
}
