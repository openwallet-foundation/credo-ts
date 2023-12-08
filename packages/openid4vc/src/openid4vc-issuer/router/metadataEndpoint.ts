import type { IssuanceRequest } from './OpenId4VcIEndpointConfiguration'
import type { CredentialIssuerMetadata, CredentialSupported } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'

export function configureIssuerMetadataEndpoint(router: Router, pathname: string) {
  router.get(pathname, (_request: IssuanceRequest, response: Response) => {
    const { agentContext, openId4vcIssuerService, logger } = getRequestContext(_request)
    try {
      const metadata = openId4vcIssuerService.expandEndpointsWithBase(agentContext)
      const transformedMetadata: CredentialIssuerMetadata = {
        credential_issuer: metadata.issuerBaseUrl,
        token_endpoint: metadata.tokenEndpointPath,
        credential_endpoint: metadata.credentialEndpointPath,
        authorization_server: metadata.authorizationServerUrl,
        credentials_supported: metadata.credentialsSupported as CredentialSupported[],
        display: metadata.issuerDisplay ? [metadata.issuerDisplay] : undefined,
      }
      response.status(200).json(transformedMetadata)
    } catch (e) {
      sendErrorResponse(response, logger, 500, 'invalid_request', e)
    }
  })
}
