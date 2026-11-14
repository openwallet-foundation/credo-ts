export function getDomainFromUrl(url: string): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error(`Invalid URL '${url}'`)
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('URL must start with "https://"')
  }

  // Userinfo can make a URL look like it belongs to a domain it doesn't point to (e.g. https://good.com:x@evil.com).
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('URL must not contain a username or password')
  }

  return parsedUrl.hostname
}
