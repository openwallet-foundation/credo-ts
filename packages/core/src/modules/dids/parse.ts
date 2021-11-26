import { parse } from 'did-resolver'

export function parseDidUrl(didUrl: string) {
  return parse(didUrl)
}
