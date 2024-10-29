import { importOauth4webapi } from '../oauth4webapi'

interface DiscoverAuthorizationRequestMetadataOptions {
  serverType: 'oidc' | 'oauth2'
}

export async function discoverAuthorizationRequestMetadata(
  issuer: string,
  { serverType }: DiscoverAuthorizationRequestMetadataOptions
) {
  const oauth = await importOauth4webapi()

  const as = await oauth
    .discoveryRequest(new URL(issuer), { algorithm: serverType })
    .then((response) => oauth.processDiscoveryResponse(new URL(issuer), response))

  return as
}
