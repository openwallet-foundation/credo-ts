export function getProtocolScheme(url: string) {
  const [protocolScheme] = url.split(':')
  return protocolScheme
}

/**
 * Whether the url uses https, or http when `allowInsecureHttpUrls` is enabled.
 */
export function isAllowedHttpUrl(url: string, allowInsecureHttpUrls: boolean) {
  return url.startsWith('https://') || (allowInsecureHttpUrls && url.startsWith('http://'))
}
