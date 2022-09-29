import type { ParsedDID } from 'did-resolver'

import { parse } from 'did-resolver'

export function parseDid(did: string): ParsedDID {
  const parsed = parse(did)

  if (!parsed) {
    throw new Error(`Error parsing did '${did}'`)
  }

  return parsed
}
