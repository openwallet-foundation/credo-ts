import type { SdJwtVcIssuerMetadata } from '@credo-ts/core'
import type { Jwk } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureJwtVcIssuerMetadataEndpoint(router: Router, path: string) {
  router.get(path, async (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(_request)
    try {
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

      const metadata: SdJwtVcIssuerMetadata =
        typeof issuer.jwks === 'string'
          ? {
              issuer: issuerMetadata.credentialIssuer.credential_issuer,
              jwks_uri: issuer.jwks,
            }
          : {
              issuer: issuerMetadata.credentialIssuer.credential_issuer,
              jwks: {
                keys: issuer.resolvedJwks?.map((jwk) => jwk.toJson({ includeKid: true }) as Jwk) ?? [],
              },
            }
      return sendJsonResponse(response, next, metadata)
    } catch (e) {
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
    }
  })
}
