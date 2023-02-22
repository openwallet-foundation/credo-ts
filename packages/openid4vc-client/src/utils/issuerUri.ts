// Extracts the credential_type parameter from a given issuer URI
export const extractCredentialType = (uri: string): string | undefined => {
  const regex = /credential_type=([^&]+)/
  const match = uri.match(regex)
  if (match) {
    return match[1]
  }
}
