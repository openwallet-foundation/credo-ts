import type { ParsedDid } from '../types'

import { parse } from 'did-resolver'

import { AriesFrameworkError } from '../../../error'

export function parseDid(did: string): ParsedDid {
  const parsed = tryParseDid(did)

  if (!parsed) {
    throw new AriesFrameworkError(`Error parsing did '${did}'`)
  }

  return parsed
}

export function tryParseDid(did: string): ParsedDid | null {
  return parse(did)
}
