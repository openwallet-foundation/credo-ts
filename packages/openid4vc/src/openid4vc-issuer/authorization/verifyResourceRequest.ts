import type { OpenId4VcIssuerRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from '../router/requestContext'
import type { AgentContext } from '@credo-ts/core'

import { CredoError, Jwt } from '@credo-ts/core'

import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

import { verifyInternalAccessToken } from './internalAuthorization'
import { verifyExternalAccessToken } from './externalAuthorization'

export async function verifyResourceRequest(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  request: OpenId4VcIssuanceRequest
) {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
  const authorizationHeader = request.headers.authorization

  if (!authorizationHeader) {
    throw new CredoError('No access token provided in the authorization header')
  }

  if (!authorizationHeader.startsWith('Bearer ') && !authorizationHeader.startsWith('DPoP ')) {
    throw new CredoError(`Invalid access token scheme. Expected Bearer or DPoP.`)
  }

  // Try parse it as JWT first, otherwise we treat it as an opaque token
  let accessToken: Jwt | string
  try {
    accessToken = Jwt.fromSerializedJwt(authorizationHeader.replace('Bearer ', '').replace('DPoP ', ''))
  } catch (error) {
    accessToken = authorizationHeader.replace('Bearer ', '').replace('DPoP ', '')
  }

  // TODO: we can support DPoP with opaque access token by extracting the data from the introspection
  // endpiont, but that will require changes to the DPoP implementation in Sphereon's lib.
  if (typeof accessToken === 'string' && authorizationHeader.startsWith('DPoP ')) {
    throw new CredoError(
      'DPoP is not supported for opaque access tokens. Either disable DPoP on the authorization server, or use a JWT access token'
    )
  }

  if (accessToken instanceof Jwt && accessToken.payload.iss === issuerMetadata.issuerUrl) {
    return await verifyInternalAccessToken(agentContext, issuer, request, accessToken)
  }

  return await verifyExternalAccessToken(agentContext, issuer, request, accessToken)
}
