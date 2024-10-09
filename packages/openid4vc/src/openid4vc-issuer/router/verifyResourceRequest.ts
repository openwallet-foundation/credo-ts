import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuerRecord } from '../repository'
import type { AgentContext } from '@credo-ts/core'
import type { SigningAlgo } from '@sphereon/oid4vc-common'

import { CredoError, joinUriParts, JwsService, Jwt } from '@credo-ts/core'
import { verifyResourceDPoP } from '@sphereon/oid4vc-common'

import { getVerifyJwtCallback } from '../../shared/utils'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export type VerifyAccessTokenResult =
  | { preAuthorizedCode: string; issuerState: undefined }
  | { preAuthorizedCode: undefined; issuerState: string }

export async function verifyResourceRequest(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  request: OpenId4VcIssuanceRequest
): Promise<VerifyAccessTokenResult> {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const authorizationHeader = request.headers.authorization

  if (!authorizationHeader) {
    throw new CredoError('No access token provided in the authorization header')
  }

  if (!authorizationHeader.startsWith('Bearer ') && !authorizationHeader.startsWith('DPoP ')) {
    throw new CredoError(`Invalid access token scheme. Expected Bearer or DPoP.`)
  }

  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
  const accessToken = Jwt.fromSerializedJwt(authorizationHeader.replace('Bearer ', '').replace('DPoP ', ''))
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
    jws: accessToken.serializedJwt,
    jwkResolver: () => {
      throw new Error('No JWK resolver available for access token verification')
    },
  })

  const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const fullUrl = joinUriParts(issuerConfig.baseUrl, [issuer.issuerId, request.url])
  await verifyResourceDPoP(
    { method: request.method, headers: request.headers, fullUrl },
    {
      jwtVerifyCallback: getVerifyJwtCallback(agentContext),
      acceptedAlgorithms: issuerMetadata.dpopSigningAlgValuesSupported as SigningAlgo[] | undefined,
    }
  )

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

  const { preAuthorizedCode, issuerState } = accessToken.payload.additionalClaims

  if (!preAuthorizedCode && !issuerState) {
    throw new CredoError('No preAuthorizedCode or issuerState present in access token')
  }

  if (preAuthorizedCode && typeof preAuthorizedCode !== 'string') {
    throw new CredoError('Invalid preAuthorizedCode present in access token')
  }

  if (issuerState && typeof issuerState !== 'string') {
    throw new CredoError('Invalid issuerState present in access token')
  }

  return {
    preAuthorizedCode: preAuthorizedCode || undefined,
    issuerState: issuerState || undefined,
  } as VerifyAccessTokenResult
}
