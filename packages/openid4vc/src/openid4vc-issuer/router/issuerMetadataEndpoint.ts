import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { CredentialIssuerMetadata } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureIssuerMetadataEndpoint(router: Router) {
  router.get(
    '/.well-known/openid-credential-issuer',
    (_request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(_request)
      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

        const transformedMetadata = {
          credential_issuer: issuerMetadata.issuerUrl,
          credential_endpoint: issuerMetadata.credentialEndpoint,
          display: issuerMetadata.issuerDisplay,

          // OID4VCI draft 11 (only one auth server is supported)
          authorization_server: issuerMetadata.authorizationServers?.[0],
          credentials_supported: issuerMetadata.credentialsSupported,

          // OID4VCI draft 13
          authorization_servers: issuerMetadata.authorizationServers,
          credential_configurations_supported: issuerMetadata.credentialConfigurationsSupported,

          // TOOD: these values should be removed, as they need to be hosted in the oauth-authorization-server
          // metadata. For backwards compatiblity we will keep them in now.
          token_endpoint: issuerMetadata.tokenEndpoint,
          dpop_signing_alg_values_supported: issuerMetadata.dpopSigningAlgValuesSupported,
        } satisfies CredentialIssuerMetadata

        response.status(200).json(transformedMetadata)
      } catch (e) {
        sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', e)
      }

      // NOTE: if we don't call next, the agentContext session handler will NOT be called
      next()
    }
  )
}
