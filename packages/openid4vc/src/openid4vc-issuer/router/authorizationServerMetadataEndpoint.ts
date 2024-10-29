import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { AuthorizationServerMetadata } from '@animo-id/oid4vci'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse, sendJsonResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

/**
 * This is the credo authorization server metadata. It is only used for pre-authorized
 * code flow.
 */
export function configureOAuthAuthorizationServerMetadataEndpoint(router: Router) {
  router.get(
    '/.well-known/oauth-authorization-server',
    (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(_request)
      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

        const authorizationServerMetadata = {
          issuer: issuerMetadata.issuerUrl,
          token_endpoint: issuerMetadata.tokenEndpoint,
          dpop_signing_alg_values_supported: issuerMetadata.dpopSigningAlgValuesSupported,
          'pre-authorized_grant_anonymous_access_supported': true,
        } satisfies AuthorizationServerMetadata

        return sendJsonResponse(response, next, authorizationServerMetadata)
      } catch (e) {
        return sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', e)
      }
    }
  )
}
