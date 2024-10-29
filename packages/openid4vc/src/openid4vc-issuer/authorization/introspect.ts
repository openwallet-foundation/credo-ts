import { importOauth4webapi, type oauth } from '../oauth4webapi'
import { getClientAuth } from './clientAuth'

export interface IntrospectTokenOptions {
  authorizationServer: oauth.AuthorizationServer

  clientId: string
  clientSecret: string

  token: string
}

export async function introspectToken({ authorizationServer, clientId, clientSecret, token }: IntrospectTokenOptions) {
  const oauth = await importOauth4webapi()
  const response = await oauth.introspectionRequest(
    authorizationServer,
    { client_id: clientId },
    await getClientAuth(authorizationServer, { clientSecret, endpointType: 'introspection' }),
    token
  )

  const introspectionResponse = await oauth.processIntrospectionResponse(
    authorizationServer,
    { client_id: clientId },
    response
  )

  return introspectionResponse
}
