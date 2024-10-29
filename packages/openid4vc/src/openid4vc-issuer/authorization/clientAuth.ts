import { CredoError } from '@credo-ts/core'
import { importOauth4webapi, type oauth } from '../oauth4webapi'

// These two are well-supported and easy to implement
export enum SupportedClientAuthenticationMethod {
  ClientSecretBasic = 'client_secret_basic',
  ClientSecretPost = 'client_secret_post',
}

const supportedClientAuthenticationMethodValues = Object.values(SupportedClientAuthenticationMethod)

export type ClientAuthEndpointType = 'introspection' | 'token'

function getSupportedClientAuthMethod(
  authorizationServer: oauth.AuthorizationServer,
  endpointType: ClientAuthEndpointType
): SupportedClientAuthenticationMethod {
  if (endpointType === 'introspection' && authorizationServer.introspection_endpoint_auth_methods_supported) {
    const supportedMethod = authorizationServer.introspection_endpoint_auth_methods_supported.find(
      (m): m is SupportedClientAuthenticationMethod =>
        Object.values(SupportedClientAuthenticationMethod).includes(m as SupportedClientAuthenticationMethod)
    )

    if (!supportedMethod) {
      throw new CredoError(
        `Authorization server metadata for issuer '${
          authorizationServer.issuer
        }' has 'introspection_endpoint_auth_methods_supported' metadata, but does not contain a supported value. Supported values by Credo are '${supportedClientAuthenticationMethodValues.join(
          ', '
        )}', found values are '${authorizationServer.introspection_endpoint_auth_methods_supported.join(', ')}'`
      )
    }

    return supportedMethod
  }

  // We allow the introspection endpoint to fallback on the token endpoint metadata if the introspection
  // metadata is not defined
  if (authorizationServer.token_endpoint_auth_methods_supported) {
    const supportedMethod = authorizationServer.token_endpoint_auth_methods_supported.find(
      (m): m is SupportedClientAuthenticationMethod =>
        Object.values(SupportedClientAuthenticationMethod).includes(m as SupportedClientAuthenticationMethod)
    )

    if (!supportedMethod) {
      throw new CredoError(
        `Authorization server metadata for issuer '${
          authorizationServer.issuer
        }' has 'token_endpoint_auth_methods_supported' metadata, but does not contain a supported value. Supported values by Credo are '${supportedClientAuthenticationMethodValues.join(
          ', '
        )}', found values are '${authorizationServer.token_endpoint_auth_methods_supported.join(', ')}'`
      )
    }

    return supportedMethod
  }

  // If omitted from metadata, the default is "client_secret_basic" according to rfc8414
  return SupportedClientAuthenticationMethod.ClientSecretBasic
}

export async function getClientAuth(
  authorizationServer: oauth.AuthorizationServer,
  { clientSecret, endpointType }: { clientSecret: string; endpointType: ClientAuthEndpointType }
): Promise<oauth.ClientAuth> {
  const oauth = await importOauth4webapi()
  const method = getSupportedClientAuthMethod(authorizationServer, endpointType)

  if (method === SupportedClientAuthenticationMethod.ClientSecretBasic) {
    return oauth.ClientSecretBasic(clientSecret)
  }

  if (method === SupportedClientAuthenticationMethod.ClientSecretPost) {
    return oauth.ClientSecretPost(clientSecret)
  }

  throw new CredoError(
    `Unsupported client auth method ${method}. Supported values are ${Object.values(
      SupportedClientAuthenticationMethod
    ).join(', ')}`
  )
}
