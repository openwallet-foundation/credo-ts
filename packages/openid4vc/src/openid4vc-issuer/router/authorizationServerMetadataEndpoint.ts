import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { AuthorizationServerMetadata } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
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

          // Required by sphereon types, but OID4VCI mentions it can be omitted if
          // only the pre-auth code flow is supported. We use empty array
          response_types_supported: []
        } satisfies AuthorizationServerMetadata

        response.status(200).json(authorizationServerMetadata)
      } catch (e) {
        sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', e)
      }

      // NOTE: if we don't call next, the agentContext session handler will NOT be called
      next()
    }
  )
}
