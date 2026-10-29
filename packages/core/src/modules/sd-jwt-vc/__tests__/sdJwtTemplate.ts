import { Hasher } from '../../../crypto'
import { TypedArrayEncoder } from '../../../utils'

// Marks a claim or array element as selectively disclosable
const SELECTIVELY_DISCLOSABLE = Symbol('selectively disclosable')
export const sd = (value: unknown) => ({ [SELECTIVELY_DISCLOSABLE]: value })
const isSd = (value: unknown): value is { [SELECTIVELY_DISCLOSABLE]: unknown } =>
  typeof value === 'object' && value !== null && SELECTIVELY_DISCLOSABLE in value

// Marks a decoy digest, as a property (with any name) of an object or an element of an array
const DECOY = Symbol('decoy')
export const decoy = () => ({ [DECOY]: true })
const isDecoy = (value: unknown) => typeof value === 'object' && value !== null && DECOY in value

/**
 * Packs a template into a signed SD-JWT payload and its disclosures. Unlike signing with a disclosure
 * frame, this can place a decoy anywhere, such as between array elements.
 */
export function packSdJwtPayload(template: Record<string, unknown>, saltPrefix: string) {
  const disclosures: string[] = []
  let saltCount = 0
  const salt = () => `${saltPrefix}-${saltCount++}`
  const digest = (value: string) => TypedArrayEncoder.toBase64Url(Hasher.hash(value, 'sha-256'))

  const disclose = (disclosure: unknown[]) => {
    const encoded = TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JSON.stringify(disclosure)))
    disclosures.push(encoded)
    return digest(encoded)
  }

  const pack = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (isDecoy(item)) return { '...': digest(salt()) }
        if (isSd(item)) return { '...': disclose([salt(), pack(item[SELECTIVELY_DISCLOSABLE])]) }
        return pack(item)
      })
    }

    if (typeof value === 'object' && value !== null) {
      const packed: Record<string, unknown> = {}
      const digests: string[] = []

      for (const [key, claim] of Object.entries(value)) {
        if (isDecoy(claim)) digests.push(digest(salt()))
        else if (isSd(claim)) digests.push(disclose([salt(), key, pack(claim[SELECTIVELY_DISCLOSABLE])]))
        else packed[key] = pack(claim)
      }

      if (digests.length > 0) packed._sd = digests.sort()
      return packed
    }

    return value
  }

  return { payload: pack(template) as Record<string, unknown>, disclosures }
}
