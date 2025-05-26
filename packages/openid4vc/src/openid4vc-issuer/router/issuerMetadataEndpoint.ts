import type { OpenId4VciCredentialIssuerMetadata } from '../../shared'
import type { OpenId4VcIssuanceGetRequest } from './requestContext'

import { getAuthorizationServerMetadataFromList } from '@openid4vc/oauth2'

import {
    CredentialRequest,
} from '@openid4vc/openid4vci'
import { CredoRouter, getRequestContext } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import createHttpError from "http-errors";

export function configureIssuerMetadataEndpoint(router: CredoRouter) {
  router.get(
    '/.well-known/openid-credential-issuer',
    async (_request: OpenId4VcIssuanceGetRequest<CredentialRequest>) => {
      const { agentContext, issuer } = getRequestContext(_request)
      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
        const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
        const issuerAuthorizationServer = getAuthorizationServerMetadataFromList(
          issuerMetadata.authorizationServers,
          issuerMetadata.credentialIssuer.credential_issuer
        )

        const transformedMetadata = {
          // Get the draft 11 metadata (it also contains drfat 14)
          ...vcIssuer.getCredentialIssuerMetadataDraft11(issuerMetadata.credentialIssuer),

          // TOOD: these values should be removed, as they need to be hosted in the oauth-authorization-server
          // metadata. For backwards compatiblity we will keep them in now.
          token_endpoint: issuerAuthorizationServer.token_endpoint,
          dpop_signing_alg_values_supported: issuerAuthorizationServer.dpop_signing_alg_values_supported,
        } satisfies OpenId4VciCredentialIssuerMetadata

        return transformedMetadata;
      } catch (e) {
        throw createHttpError(500, e);
      }
    }
  )
}
