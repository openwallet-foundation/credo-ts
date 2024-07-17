const endings = ['/', ':', '?', '#']
const starters = ['.', '/', '@']

/**
 * Get domain from url
 * https://github.com/bjarneo/extract-domain/blob/master/index.ts
 */
export function getDomainFromUrl(url: string): string {
  let domainInc: number = 0
  let offsetDomain: number = 0
  let offsetStartSlice: number = 0
  let offsetPath: number = 0
  let len: number = url.length
  let i: number = 0

  while (len-- && ++i) {
    if (domainInc && endings.indexOf(url[i]) > -1) break
    if (url[i] !== '.') continue
    ++domainInc
    offsetDomain = i
  }

  offsetPath = i
  i = offsetDomain
  while (i--) {
    if (starters.indexOf(url[i]) === -1) continue
    offsetStartSlice = i + 1
    break
  }

  if (offsetStartSlice === 0 && offsetPath > 3) return url
  if (offsetStartSlice > 0 && offsetStartSlice < 2) return ''
  return url.slice(offsetStartSlice, offsetPath)
}
