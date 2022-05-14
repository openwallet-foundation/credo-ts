export function getProtocolScheme(url: string) {
  const [protocolScheme] = url.split(':')
  return protocolScheme
}
