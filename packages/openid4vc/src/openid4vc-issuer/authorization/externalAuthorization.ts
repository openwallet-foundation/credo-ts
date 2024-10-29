import type { OpenId4VciAuthorizationServerConfig } from '../../shared'
import type { OpenId4VcIssuerRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from '../router'
import type { AgentContext, JwtPayloadJson } from '@credo-ts/core'

import { Jwt, CredoError } from '@credo-ts/core'

import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

import { discoverAuthorizationRequestMetadata } from './discover'
import { introspectToken } from './introspect'
import { importOauth4webapi, type oauth } from '../oauth4webapi'

export async function verifyExternalAccessToken(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  request: OpenId4VcIssuanceRequest,
  accessToken: Jwt | string
) {
  const oauth = await importOauth4webapi()
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

  let authorizationServer: OpenId4VciAuthorizationServerConfig
  let tokenPayload: JwtPayloadJson | oauth.IntrospectionResponse

  if (!issuer.authorizationServerConfigs || issuer.authorizationServerConfigs.length === 0) {
    throw new CredoError(`No external authorization servers configured on issuer '${issuerMetadata.issuerUrl}'`)
  }

  if (accessToken instanceof Jwt) {
    if (!accessToken.payload.iss) {
      throw new CredoError("Missing 'iss' parameter in JWT access token.")
    }

    const _authorizationServer = issuer.authorizationServerConfigs?.find(
      (config) => config.issuer === accessToken.payload.iss
    )

    if (!_authorizationServer) {
      throw new CredoError(
        `Authorization server '${accessToken.payload.iss}' is not configured for issuer ${issuerMetadata.issuerUrl}`
      )
    }

    const authorizationServerMetadata = await discoverAuthorizationRequestMetadata(_authorizationServer.issuer, {
      serverType: _authorizationServer.serverType,
    })

    // This fetches the jwks_uri and uses that to verify the jwt access token.
    // TODO: support dpop nonce
    await oauth.validateJwtAccessToken(
      authorizationServerMetadata,
      new Request(request.originalUrl, {
        headers: request.headers as Record<string, string>,
        method: request.method,
        body: request.body,
      }),
      authorizationServerMetadata.issuer
    )

    authorizationServer = _authorizationServer
    tokenPayload = accessToken.payload.toJson()
  }
  // JWT is of type string
  else {
    let _authorizationServer: OpenId4VciAuthorizationServerConfig | undefined = undefined
    let _tokenPayload: oauth.IntrospectionResponse | undefined = undefined

    for (const authorizationServerConfig of issuer.authorizationServerConfigs) {
      try {
        if (!authorizationServerConfig.clientId || !authorizationServerConfig.clientSecret) {
          throw new CredoError(
            `Missing required clientId and clientSecret for authorization server '${authorizationServerConfig.issuer}' in issuer ${issuer.issuerId}. clientId and clientSecret are required for token introspection when using opaque tokens from external authorization servers.`
          )
        }

        // TODO: store server type in authorization server config
        const authorizationServerMetadata = await discoverAuthorizationRequestMetadata(
          authorizationServerConfig.issuer,
          {
            serverType: 'oauth2',
          }
        )

        const introspectionResponse = await introspectToken({
          authorizationServer: authorizationServerMetadata,
          clientId: authorizationServerConfig.clientId,
          clientSecret: authorizationServerConfig.clientSecret,
          token: accessToken,
        })

        if (!introspectionResponse.active) {
          throw new CredoError('Access token is not active')
        }

        // TODO: support dpop verification
        if (introspectionResponse.token_type === 'DPoP') {
          throw new CredoError(
            'Access token with introspection is using DPoP which is not supported for opaque access tokens. DPoP is only supported for JWT access tokens.'
          )
        }

        _authorizationServer = authorizationServerConfig
        _tokenPayload = introspectionResponse
        break
      } catch (error) {
        continue
      }
    }

    if (!_authorizationServer || !_tokenPayload) {
      throw new CredoError(
        'Unable to verify opaque access token using introspection endpoint at any of the configured authorizaiton servers'
      )
    }
    authorizationServer = _authorizationServer
    tokenPayload = _tokenPayload
  }

  // we have verified the token payload here. Now we want to do some additional checks
  if (tokenPayload.sub !== issuerMetadata.issuerUrl) {
    throw new CredoError(`Expected access token 'sub' to equal issuer '${issuerMetadata.issuerUrl}'`)
  }

  if (!tokenPayload.issuer_state || typeof tokenPayload.issuer_state !== 'string') {
    throw new CredoError(`Missing 'issuer_state' parameter in access token or introspection response`)
  }

  return { authorizationServerConfig: authorizationServer, issuerState: tokenPayload.issuer_state }
}
