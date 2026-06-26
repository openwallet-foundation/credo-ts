import { decodeSdJwtSync } from '@sd-jwt/decode'
import { selectDisclosures } from '@sd-jwt/present'
import { isObject } from 'class-validator'
import { Hasher } from '../../crypto'
import type { JsonObject } from '../../types'
import { SdJwtVcError } from './SdJwtVcError'

type DisclosureFrame = {
  [key: string]: boolean | DisclosureFrame
}

export function buildDisclosureFrameForPayload(input: JsonObject): DisclosureFrame {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      // TODO: Array disclosure frames are not yet supported - treating entire array as disclosed
      if (Array.isArray(value)) {
        return [key, true]
      }
      if (isObject(value)) {
        if (Object.keys.length === 0) return [key, false]
        return [key, buildDisclosureFrameForPayload(value)]
      }
      return [key, true]
    })
  )
}

export function applyDisclosuresForPayload(compactSdJwt: string, requestedPayload: JsonObject) {
  const decoded = decodeSdJwtSync(compactSdJwt, Hasher.hash)
  const presentationFrame = buildDisclosureFrameForPayload(requestedPayload) ?? {}

  if (decoded.kbJwt) {
    throw new SdJwtVcError('Cannot apply limit disclosure on an sd-jwt with key binding jwt')
  }

  const requiredDisclosures = selectDisclosures(
    decoded.jwt.payload,
    // Map to sd-jwt disclosure format
    decoded.disclosures.map((d) => ({
      digest: d.digestSync({ alg: 'sha-256', hasher: Hasher.hash }),
      encoded: d.encode(),
      key: d.key,
      salt: d.salt,
      value: d.value,
    })),
    presentationFrame as { [key: string]: boolean }
  )
  const [jwt] = compactSdJwt.split('~')
  const disclosuresString =
    requiredDisclosures.length > 0 ? `${requiredDisclosures.map((d) => d.encoded).join('~')}~` : ''
  const sdJwt = `${jwt}~${disclosuresString}`
  return sdJwt
}
