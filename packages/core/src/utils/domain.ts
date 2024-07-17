export function getDomainFromUrl(url: string): string {
  const regex = /[#/?]/
  const domain = url.substring('https://'.length).split(regex)[0]
  return domain
}
