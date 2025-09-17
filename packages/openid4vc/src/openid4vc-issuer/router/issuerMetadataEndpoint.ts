import type { Response, Router } from 'express'
import type { OpenId4VciCredentialIssuerMetadata } from '../../shared'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { getAuthorizationServerMetadataFromList } from '@openid4vc/oauth2'

import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureIssuerMetadataEndpoint(router: Router) {
  router.get(
    '/.well-known/openid-credential-issuer',
    async (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(_request)
      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
        const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
        const issuerAuthorizationServer = getAuthorizationServerMetadataFromList(
          issuerMetadata.authorizationServers,
          issuerMetadata.credentialIssuer.credential_issuer
        )

        const transformedMetadata = {
          // Get the draft 11 metadata (it also contains draft 14)
          ...vcIssuer.getCredentialIssuerMetadataDraft11(issuerMetadata.credentialIssuer),

          // TODO: these values should be removed, as they need to be hosted in the oauth-authorization-server
          // metadata. For backwards compatibility we will keep them in now.
          token_endpoint: issuerAuthorizationServer.token_endpoint,
          dpop_signing_alg_values_supported: issuerAuthorizationServer.dpop_signing_alg_values_supported,
        } satisfies OpenId4VciCredentialIssuerMetadata

        return sendJsonResponse(response, next, transformedMetadata)
      } catch (e) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
      }
    }
  )
}
