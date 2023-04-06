import type { ParsedDid } from '@aries-framework/core'

const UUID = '([a-z,0-9,-]{36,36})'
const ID_CHAR = `(?:[a-zA-Z0-9]{21,22}|${UUID})`
const NETWORK = '(testnet|mainnet)'
const METHOD_ID = `((?:${ID_CHAR}*:)*(${ID_CHAR}+))`
const PATH = `(/[^#?]*)?`
const QUERY = `([?][^#]*)?`
const VERSION_ID = `(.*?)`

export const cheqdSdkAnonCredsRegistryIdentifierRegex = new RegExp(
  `^did:cheqd:${NETWORK}:${METHOD_ID}${PATH}${QUERY}$`
)

export const cheqdDidRegex = new RegExp(`^did:cheqd:${NETWORK}:${METHOD_ID}${QUERY}$`)
export const cheqdDidVersionRegex = new RegExp(`^did:cheqd:${NETWORK}:${METHOD_ID}/version/${VERSION_ID}${QUERY}$`)
export const cheqdDidVersionsRegex = new RegExp(`^did:cheqd:${NETWORK}:${METHOD_ID}/versions${QUERY}$`)
export const cheqdDidMetadataRegex = new RegExp(`^did:cheqd:${NETWORK}:${METHOD_ID}/metadata${QUERY}$`)
export const cheqdResourceRegex = new RegExp(`^did:cheqd:${NETWORK}:${METHOD_ID}/resources/${UUID}${QUERY}$`)
export const cheqdResourceMetadataRegex = new RegExp(
  `^did:cheqd:${NETWORK}:${METHOD_ID}/resources/${UUID}/metadata${QUERY}`
)

export type ParsedCheqdDid = ParsedDid & { network: string }
export function parseCheqdDid(didUrl: string): ParsedCheqdDid | null {
  if (didUrl === '' || !didUrl) return null
  const sections = didUrl.match(cheqdSdkAnonCredsRegistryIdentifierRegex)
  if (sections) {
    const parts: ParsedCheqdDid = {
      did: `did:cheqd:${sections[1]}:${sections[2]}`,
      method: 'cheqd',
      network: sections[1],
      id: sections[2],
      didUrl,
    }
    if (sections[7]) {
      const params = sections[7].slice(1).split('&')
      parts.params = {}
      for (const p of params) {
        const kv = p.split('=')
        parts.params[kv[0]] = kv[1]
      }
    }
    if (sections[6]) parts.path = sections[6]
    if (sections[8]) parts.fragment = sections[8].slice(1)
    return parts
  }
  return null
}
