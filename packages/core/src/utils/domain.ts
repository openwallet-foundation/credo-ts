export function getDomainFromUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with "https://"')
  }

  const regex = /[#/?]/
  const domain = url.split('://')[1].split(regex)[0]
  return domain
}
