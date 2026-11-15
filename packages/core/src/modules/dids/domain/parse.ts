import { parse } from 'did-resolver'
import { CredoError } from '../../../error'
import type { ParsedDid } from '../types'

export function parseDid(did: string): ParsedDid {
  const parsed = tryParseDid(did)

  if (!parsed) {
    throw new CredoError(`Error parsing did '${did}'`)
  }

  return parsed
}

export function tryParseDid(did: string): ParsedDid | null {
  return parse(did)
}

/**
 * Resolves a relative DID URL such as `#key-1`, which DID documents may use for their verification methods,
 * against `did`. An absolute DID URL is returned as-is.
 */
export function toAbsoluteDidUrl(did: string, didUrl: string): string {
  return didUrl.startsWith('#') ? `${did}${didUrl}` : didUrl
}
