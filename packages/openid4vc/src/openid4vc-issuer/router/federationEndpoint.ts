import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { FederationKeyCallback } from '../../shared/federation'
import type { Buffer } from '@credo-ts/core'
import type { Router, Response } from 'express'

import { getJwkFromKey } from '@credo-ts/core'
import { createEntityConfiguration } from '@openid-federation/core'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export interface OpenId4VcSiopFederationEndpointConfig {
  /**
   * The path at which the credential endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /.well-known/openid-federation
   */
  endpointPath: string

  // TODO: Not sure about the property name yet.
  //TODO: More information is needed than only the key also the client id etc
  keyCallback: FederationKeyCallback<{
    issuerId: string
  }>
}

// TODO: It's also possible that the issuer and the verifier can have the same openid-federation endpoint. In that case we need to combine them.

export function configureFederationEndpoint(router: Router, config: OpenId4VcSiopFederationEndpointConfig) {
  router.get(config.endpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

    try {
      const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      // TODO: Use a type here from sphreon
      const transformedMetadata = {
        credential_issuer: issuerMetadata.issuerUrl,
        token_endpoint: issuerMetadata.tokenEndpoint,
        credential_endpoint: issuerMetadata.credentialEndpoint,
        authorization_server: issuerMetadata.authorizationServer,
        authorization_servers: issuerMetadata.authorizationServer ? [issuerMetadata.authorizationServer] : undefined,
        credentials_supported: issuerMetadata.credentialsSupported,
        credential_configurations_supported: issuerMetadata.credentialConfigurationsSupported,
        display: issuerMetadata.issuerDisplay,
        dpop_signing_alg_values_supported: issuerMetadata.dpopSigningAlgValuesSupported,
      } as const

      const now = new Date()
      const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24) // 1 day from now

      const { key } = await config.keyCallback(agentContext, {
        issuerId: issuer.issuerId,
      })

      const jwk = getJwkFromKey(key)
      const kid = 'key-1'
      const alg = jwk.supportedSignatureAlgorithms[0]

      const issuerDisplay = issuerMetadata.issuerDisplay?.[0]

      const entityConfiguration = await createEntityConfiguration({
        claims: {
          sub: issuerMetadata.issuerUrl,
          iss: issuerMetadata.issuerUrl,
          iat: now,
          exp: expires,
          jwks: {
            keys: [{ kid, alg, ...jwk.toJson() }],
          },
          metadata: {
            federation_entity: issuerDisplay
              ? {
                  organization_name: issuerDisplay.organization_name,
                  logo_uri: issuerDisplay.logo_uri,
                }
              : undefined,
            openid_credential_issuer: transformedMetadata,
          },
        },
        header: {
          kid,
          alg,
          typ: 'entity-statement+jwt',
        },
        signJwtCallback: ({ toBeSigned }) =>
          agentContext.wallet.sign({
            data: toBeSigned as Buffer,
            key,
          }),
      })

      response.writeHead(200, { 'Content-Type': 'application/entity-statement+jwt' }).end(entityConfiguration)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
