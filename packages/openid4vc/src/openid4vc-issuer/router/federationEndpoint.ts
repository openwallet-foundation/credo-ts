import { type Buffer, Kms } from '@credo-ts/core'
import type { Response, Router } from 'express'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { type EntityConfigurationClaimsOptions, createEntityConfiguration } from '@openid-federation/core'

import { getRequestContext, sendErrorResponse } from '../../shared/router'

// TODO: It's also possible that the issuer and the verifier can have the same openid-federation endpoint. In that case we need to combine them.

export function configureFederationEndpoint(router: Router) {
  // TODO: this whole result needs to be cached and the ttl should be the expires of this node

  router.get('/.well-known/openid-federation', async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)

    try {
      const kms = agentContext.resolve(Kms.KeyManagementApi)

      // TODO: Should be only created once per issuer and be used between instances
      const federationKey = Kms.PublicJwk.fromPublicJwk(
        (
          await kms.createKey({
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          })
        ).publicJwk
      )

      const now = new Date()
      const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24) // 1 day from now

      // TODO: We need to generate a key and always use that for the entity configuration

      const kid = federationKey.keyId
      const alg = federationKey.signatureAlgorithm

      const issuerDisplay = issuer.display?.[0]

      const entityConfiguration = await createEntityConfiguration({
        claims: {
          sub: issuer.issuerId,
          iss: issuer.issuerId,
          iat: now,
          exp: expires,
          jwks: {
            keys: [{ alg, ...federationKey.toJson() } as EntityConfigurationClaimsOptions['jwks']['keys'][number]],
          },
          metadata: {
            federation_entity: issuerDisplay
              ? {
                  organization_name: issuerDisplay.name,
                  logo_uri: issuerDisplay.logo?.uri,
                }
              : undefined,
            openid_provider: {
              // TODO: The type isn't correct yet down the line so that needs to be updated before
              // credential_issuer: issuerMetadata.issuerUrl,
              // token_endpoint: issuerMetadata.tokenEndpoint,
              // credential_endpoint: issuerMetadata.credentialEndpoint,
              // authorization_server: issuerMetadata.authorizationServer,
              // authorization_servers: issuerMetadata.authorizationServer
              //   ? [issuerMetadata.authorizationServer]
              //   : undefined,
              // credentials_supported: issuerMetadata.credentialsSupported,
              // credential_configurations_supported: issuerMetadata.credentialConfigurationsSupported,
              // display: issuerMetadata.issuerDisplay,
              // dpop_signing_alg_values_supported: issuerMetadata.dpopSigningAlgValuesSupported,

              client_registration_types_supported: ['automatic'],
              jwks: {
                keys: [
                  // TODO: Not 100% sure if this is the right key that we want to expose here or a different one
                  issuer.resolvedAccessTokenPublicJwk.toJson() as EntityConfigurationClaimsOptions['jwks']['keys'][number],
                ],
              },
            },
          },
        },
        header: {
          kid,
          alg,
          typ: 'entity-statement+jwt',
        },
        signJwtCallback: async ({ toBeSigned }) => {
          const kms = agentContext.resolve(Kms.KeyManagementApi)
          const signed = await kms.sign({
            data: toBeSigned as Buffer,
            algorithm: federationKey.signatureAlgorithm,
            keyId: federationKey.keyId,
          })

          return signed.signature
        },
      })

      response.writeHead(200, { 'Content-Type': 'application/entity-statement+jwt' }).end(entityConfiguration)
    } catch (error) {
      agentContext.config.logger.error('Failed to create entity configuration', {
        error,
      })
      sendErrorResponse(
        response,
        next,
        agentContext.config.logger,
        500,
        'invalid_request',
        'Failed to create entity configuration'
      )
      return
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
