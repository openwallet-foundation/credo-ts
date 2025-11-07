import { getAuthorizationServerMetadataFromList } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import type { OpenId4VciCredentialIssuerMetadata } from '../../shared'
import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureIssuerMetadataEndpoint(router: Router, path: string) {
  router.get(path, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    try {
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
      const issuerAuthorizationServer = getAuthorizationServerMetadataFromList(
        issuerMetadata.authorizationServers,
        issuerMetadata.credentialIssuer.credential_issuer
      )

      // NOTE: for now we default to unsigned if the wallet doesn't explicitly indicate it supports signed
      const acceptedMediaTypes = request.headers.accept ? parseAcceptHeader(request.headers.accept) : []

      const mediaTypeToUse =
        acceptedMediaTypes.find(
          ({ mediaType }) =>
            mediaType === 'application/json' || (issuerMetadata.signedMetadataJwt && mediaType === 'application/jwt')
        )?.mediaType ?? 'application/json'

      const transformedMetadata = {
        // Get the draft 11 metadata (it also contains draft 14)
        ...vcIssuer.getCredentialIssuerMetadataDraft11(issuerMetadata.credentialIssuer),

        // TODO: these values should be removed, as they need to be hosted in the oauth-authorization-server
        // metadata. For backwards compatibility we will keep them in now.
        token_endpoint: issuerAuthorizationServer.token_endpoint,
        dpop_signing_alg_values_supported: issuerAuthorizationServer.dpop_signing_alg_values_supported,
      } satisfies OpenId4VciCredentialIssuerMetadata

      if (issuerMetadata.signedMetadataJwt && mediaTypeToUse === 'application/jwt') {
        response.type('application/jwt').status(200).send(issuerMetadata.signedMetadataJwt)
      } else {
        return sendJsonResponse(response, next, transformedMetadata)
      }
    } catch (e) {
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
    }
  })
}

function parseAcceptHeader(header: string) {
  return header
    .split(',')
    .map((type) => {
      const [mediaType, ...params] = type.trim().split(';')
      let quality = 1

      // Extract quality value if present
      const qParam = params.find((p) => p.trim().startsWith('q='))
      if (qParam) {
        quality = parseFloat(qParam.split('=')[1]) || 1.0
      }

      return {
        mediaType: mediaType.trim(),
        quality: quality,
      }
    })
    .sort((a, b) => b.quality - a.quality) // Sort by preference
}
