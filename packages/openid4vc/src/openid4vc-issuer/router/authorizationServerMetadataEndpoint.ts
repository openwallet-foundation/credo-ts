import { getAuthorizationServerMetadataFromList } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { parseAcceptHeader } from './issuerMetadataEndpoint'
import type { OpenId4VcIssuanceRequest } from './requestContext'

/**
 * This is the credo authorization server metadata. It is only used for pre-authorized
 * code flow.
 */
export function configureOAuthAuthorizationServerMetadataEndpoint(router: Router, path: string) {
  router.get(path, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    try {
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      const issuerAuthorizationServer = getAuthorizationServerMetadataFromList(
        issuerMetadata.authorizationServers,
        issuerMetadata.credentialIssuer.credential_issuer
      )

      const acceptsJwt = request.headers.accept
        ? parseAcceptHeader(request.headers.accept).find(
            ({ mediaType }) => mediaType === 'application/json' || mediaType === 'application/jwt'
          )?.mediaType === 'application/jwt'
        : false
      const signedMetadataJwt = acceptsJwt
        ? await openId4VcIssuerService.createSignedAuthorizationServerMetadataJwt(
            agentContext,
            issuer,
            issuerAuthorizationServer
          )
        : undefined

      if (signedMetadataJwt) {
        response.type('application/jwt').status(200).send(signedMetadataJwt)
        return next()
      }

      return sendJsonResponse(response, next, issuerAuthorizationServer)
    } catch (e) {
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
    }
  })
}
