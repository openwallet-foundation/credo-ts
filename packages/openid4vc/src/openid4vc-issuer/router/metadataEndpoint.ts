import type { IssuanceRequest } from './requestContext'
import type { CredentialIssuerMetadata } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureIssuerMetadataEndpoint(router: Router) {
  router.get('/.well-known/openid-credential-issuer', (_request: IssuanceRequest, response: Response) => {
    const { agentContext, issuer } = getRequestContext(_request)

    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    try {
      const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      const transformedMetadata = {
        credential_issuer: issuerMetadata.issuerUrl,
        token_endpoint: issuerMetadata.tokenEndpoint,
        credential_endpoint: issuerMetadata.credentialEndpoint,
        authorization_server: issuerMetadata.authorizationServer,
        credentials_supported: issuerMetadata.credentialsSupported,
        display: issuerMetadata.issuerDisplay,
      } satisfies CredentialIssuerMetadata

      response.status(200).json(transformedMetadata)
    } catch (e) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', e)
    }
  })
}
