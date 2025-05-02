import type { JwkSet } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { Kms } from '@credo-ts/core'

import { getRequestContext, sendJsonResponse, sendUnknownServerErrorResponse } from '../../shared/router'

export function configureJwksEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(config.jwksEndpointPath, async (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(_request)
    try {
      const jwks = {
        keys: [
          Kms.PublicJwk.fromFingerprint(issuer.accessTokenPublicKeyFingerprint).toJson() as JwkSet['keys'][number],
        ],
      } satisfies JwkSet

      return sendJsonResponse(response, next, jwks, 'application/jwk-set+json')
    } catch (e) {
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, e)
    }
  })
}
