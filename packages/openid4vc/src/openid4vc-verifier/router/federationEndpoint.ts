import type { Buffer } from '@credo-ts/core'
import { JwsService, Kms } from '@credo-ts/core'
import {
  createEntityConfiguration,
  createEntityStatement,
  type EntityConfigurationClaimsOptions,
  fetchEntityConfiguration,
  type JsonWebKey,
} from '@openid-federation/core'
import { addSecondsToDate } from '@openid4vc/utils'
import type { Response, Router } from 'express'
import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'
import { OpenId4VpVerifierService } from '../OpenId4VpVerifierService'
import type { OpenId4VcVerificationRequest } from './requestContext'

export function configureFederationEndpoint(
  router: Router,
  federationConfig: OpenId4VcVerifierModuleConfig['federation'] = {}
) {
  // TODO: this whole result needs to be cached and the ttl should be the expires of this node

  // TODO: This will not work for multiple instances so we have to save it in the database.
  const federationKeyMapping = new Map<string, Kms.PublicJwk>()
  const rpSigningKeyMapping = new Map<string, Kms.PublicJwk>()

  router.get(
    '/.well-known/openid-federation',
    async (request: OpenId4VcVerificationRequest, response: Response, next) => {
      const { agentContext, verifier } = getRequestContext(request)
      const verifierService = agentContext.dependencyManager.resolve(OpenId4VpVerifierService)
      const verifierConfig = agentContext.dependencyManager.resolve(OpenId4VcVerifierModuleConfig)

      try {
        let federationKey = federationKeyMapping.get(verifier.verifierId)
        if (!federationKey) {
          const kms = agentContext.resolve(Kms.KeyManagementApi)
          federationKey = Kms.PublicJwk.fromPublicJwk(
            (
              await kms.createKey({
                type: {
                  kty: 'OKP',
                  crv: 'Ed25519',
                },
              })
            ).publicJwk
          )
          federationKeyMapping.set(verifier.verifierId, federationKey)
        }

        let rpSigningKey = rpSigningKeyMapping.get(verifier.verifierId)
        if (!rpSigningKey) {
          const kms = agentContext.resolve(Kms.KeyManagementApi)
          rpSigningKey = Kms.PublicJwk.fromPublicJwk(
            (
              await kms.createKey({
                type: {
                  kty: 'OKP',
                  crv: 'Ed25519',
                },
              })
            ).publicJwk
          )
          rpSigningKeyMapping.set(verifier.verifierId, rpSigningKey)
        }

        const verifierEntityId = `${verifierConfig.baseUrl}/${verifier.verifierId}`
        const clientMetadata = await verifierService.getClientMetadata(agentContext, {
          responseMode: 'direct_post.jwt',
          verifier,
          version: 'v1.draft24',
        })

        // TODO: We also need to cache the entity configuration until it expires
        const now = new Date()
        // TODO: We also need to check if the x509 certificate is still valid until this expires
        const expires = addSecondsToDate(now, 60 * 60 * 24) // 1 day

        const alg = federationKey.signatureAlgorithm
        const kid = federationKey.keyId

        const authorityHints = await federationConfig.getAuthorityHints?.(agentContext, {
          verifierId: verifier.verifierId,
          issuerEntityId: verifierEntityId,
        })

        const clientMetadataKeys = clientMetadata.jwks?.keys ?? []
        const entityConfiguration = await createEntityConfiguration({
          header: {
            kid,
            alg,
            typ: 'entity-statement+jwt',
          },
          claims: {
            sub: verifierEntityId,
            iss: verifierEntityId,
            iat: now,
            exp: expires,
            jwks: {
              keys: [
                {
                  alg,
                  ...federationKey.toJson(),
                } as EntityConfigurationClaimsOptions['jwks']['keys'][number],
              ],
            },
            authority_hints: authorityHints,
            metadata: {
              federation_entity: {
                organization_name: clientMetadata.client_name,
                logo_uri: clientMetadata.logo_uri,
                federation_fetch_endpoint: `${verifierEntityId}/openid-federation/fetch`,
              },
              openid_relying_party: {
                ...clientMetadata,
                jwks: {
                  keys: [
                    {
                      ...rpSigningKey.toJson(),
                      kid: rpSigningKey.keyId,
                      alg,
                      use: 'sig',
                    },
                    ...clientMetadataKeys,
                  ] as EntityConfigurationClaimsOptions['jwks']['keys'],
                },
                client_registration_types: ['automatic'], // TODO: Not really sure why we need to provide this manually
              },
            },
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
        sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', error)
        return
      }

      // NOTE: if we don't call next, the agentContext session handler will NOT be called
      next()
    }
  )

  // TODO: Currently it will fetch everything in realtime and creates a entity statement without even checking if it is allowed.
  router.get('/openid-federation/fetch', async (request: OpenId4VcVerificationRequest, response: Response, next) => {
    const { agentContext, verifier } = getRequestContext(request)

    const { sub } = request.query
    if (!sub || typeof sub !== 'string') {
      sendErrorResponse(response, next, agentContext.config.logger, 400, 'invalid_request', 'sub is required')
      return
    }

    const verifierConfig = agentContext.dependencyManager.resolve(OpenId4VcVerifierModuleConfig)

    const entityId = `${verifierConfig.baseUrl}/${verifier.verifierId}`

    const isSubordinateEntity = await federationConfig.isSubordinateEntity?.(agentContext, {
      verifierId: verifier.verifierId,
      issuerEntityId: entityId,
      subjectEntityId: sub,
    })
    if (!isSubordinateEntity) {
      if (!federationConfig.isSubordinateEntity) {
        agentContext.config.logger.warn(
          'isSubordinateEntity hook is not provided for the federation so we cannot check if this entity is a subordinate entity of the issuer',
          {
            verifierId: verifier.verifierId,
            issuerEntityId: entityId,
            subjectEntityId: sub,
          }
        )
      }

      sendErrorResponse(
        response,
        next,
        agentContext.config.logger,
        403,
        'forbidden',
        'This entity is not a subordinate entity of the issuer'
      )
      return
    }

    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const subjectEntityConfiguration = await fetchEntityConfiguration({
      entityId: sub,
      verifyJwtCallback: async ({ jwt, jwk }) => {
        const res = await jwsService.verifyJws(agentContext, {
          jws: jwt,
          jwsSigner: {
            method: 'jwk',
            jwk: Kms.PublicJwk.fromUnknown(jwk),
          },
        })

        return res.isValid
      },
    })

    let federationKey = federationKeyMapping.get(verifier.verifierId)
    if (!federationKey) {
      const kms = agentContext.resolve(Kms.KeyManagementApi)
      federationKey = Kms.PublicJwk.fromPublicJwk(
        (
          await kms.createKey({
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          })
        ).publicJwk
      )
      federationKeyMapping.set(verifier.verifierId, federationKey)
    }

    const alg = federationKey.signatureAlgorithm
    const kid = federationKey.keyId

    const entityStatement = await createEntityStatement({
      header: {
        kid,
        alg,
        typ: 'entity-statement+jwt',
      },
      jwk: federationKey.toJson() as JsonWebKey,
      claims: {
        sub: sub,
        iss: entityId,
        iat: new Date(),
        exp: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day TODO: Might needs to be a bit lower because a day is quite long for trust
        jwks: {
          keys: subjectEntityConfiguration.jwks.keys,
        },
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

    response.writeHead(200, { 'Content-Type': 'application/entity-statement+jwt' }).end(entityStatement)
  })
}
