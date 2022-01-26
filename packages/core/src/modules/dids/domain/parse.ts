import type { ParsedDid } from '../types'

import { parse } from 'did-resolver'

export function parseDid(did: string): ParsedDid {
  const parsed = parse(did)

  if (!parsed) {
    throw new Error(`Error parsing did '${did}'`)
  }

  return parsed
}
