import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { CredentialIssuerMetadata } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { credentialsSupportedV11ToV13 } from '../../shared/issuerMetadataUtils'
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
          token_endpoint: issuerMetadata.tokenEndpoint,
          credential_endpoint: issuerMetadata.credentialEndpoint,
          authorization_server: issuerMetadata.authorizationServer,
          authorization_servers: issuerMetadata.authorizationServer ? [issuerMetadata.authorizationServer] : undefined,
          credentials_supported: issuerMetadata.credentialsSupported,
          credential_configurations_supported:
            issuer.credentialConfigurationsSupported ??
            credentialsSupportedV11ToV13(agentContext, issuerMetadata.credentialsSupported),
          display: issuerMetadata.issuerDisplay,
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
