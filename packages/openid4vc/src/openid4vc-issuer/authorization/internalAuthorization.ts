import type { OpenId4VcIssuerRecord } from '../repository'
import type { AgentContext, Jwt } from '@credo-ts/core'

import { CredoError, joinUriParts, JwsService } from '@credo-ts/core'

import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuanceRequest } from '../router'
import { SigningAlgo, verifyResourceDPoP } from '@sphereon/oid4vc-common'
import { getVerifyJwtCallback } from '../../shared/utils'

export async function verifyInternalAccessToken(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  request: OpenId4VcIssuanceRequest,
  accessToken: Jwt
) {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
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

  // TODO: support dpop nonce
  // Verify DPoP
  const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const fullUrl = joinUriParts(issuerConfig.baseUrl, [issuer.issuerId, request.url])
  await verifyResourceDPoP(
    { method: request.method, headers: request.headers, fullUrl },
    {
      jwtVerifyCallback: getVerifyJwtCallback(agentContext),
      acceptedAlgorithms: issuerMetadata.dpopSigningAlgValuesSupported as SigningAlgo[] | undefined,
    }
  )

  const { preAuthorizedCode } = accessToken.payload.additionalClaims

  if (!preAuthorizedCode) {
    throw new CredoError('No preAuthorizedCode present in access token')
  }

  if (typeof preAuthorizedCode !== 'string') {
    throw new CredoError('Invalid preAuthorizedCode present in access token')
  }

  return {
    preAuthorizedCode,
  }
}
