export function getDomainFromUrl(url: string): string {
  if (!url.startsWith('https://')) {
    throw new Error('URL must start with "https://"')
  }

  const regex = /[#/?]/
  const domain = url.substring('https://'.length).split(regex)[0]
  return domain
}
