import type { OpenId4VcIssuerRecord } from '../repository'
import type { AgentContext } from '@credo-ts/core'

import { CredoError, JwsService, Jwt } from '@credo-ts/core'
import { PRE_AUTH_CODE_LITERAL } from '@sphereon/oid4vci-common'

import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export async function verifyAccessToken(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  authorizationHeader?: string
) {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new CredoError('No access token provided in the authorization header')
  }

  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
  const accessToken = Jwt.fromSerializedJwt(authorizationHeader.replace('Bearer ', ''))
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
    jws: accessToken.serializedJwt,
    jwkResolver: () => {
      throw new Error('No JWK resolver available for access token verification')
    },
  })

  if (!isValid) {
    throw new CredoError('Signature on access token is invalid')
  }

  if (!signerKeys.map((key) => key.fingerprint).includes(issuer.accessTokenPublicKeyFingerprint)) {
    throw new CredoError('Access token was not signed by the expected issuer')
  }

  // Finally validate the JWT payload (expiry etc..)
  accessToken.payload.validate()

  if (accessToken.payload.iss !== issuerMetadata.issuerUrl) {
    throw new CredoError('Access token was not issued by the expected issuer')
  }

  if (typeof accessToken.payload.additionalClaims[PRE_AUTH_CODE_LITERAL] !== 'string') {
    throw new CredoError('No pre-authorized code present in access token')
  }

  return {
    preAuthorizedCode: accessToken.payload.additionalClaims[PRE_AUTH_CODE_LITERAL],
  }
}
