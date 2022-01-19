import type { ParsedDid } from './types'

import { parse } from 'did-resolver'

export function parseDid(did: string): ParsedDid | null {
  return parse(did)
}
