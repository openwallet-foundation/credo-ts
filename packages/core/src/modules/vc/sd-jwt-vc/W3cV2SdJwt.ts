import { decodeSdJwtSync, getClaimsSync } from '@sd-jwt/decode'
import { Hasher } from '../../../crypto'
import { CredoError } from '../../../error'
import { type SingleOrArray, isJsonObject } from '../../../types'
import { ClaimFormat } from '../models'

export interface W3cV2SdJwtHeader {
  alg: string
  kid?: string
  [property: string]: unknown
}

export interface W3cV2SdJwtPayload {
  type: SingleOrArray<string>
  iss?: string
  jti?: string
  [property: string]: unknown
}

export interface W3cV2SdJwt<T extends ClaimFormat.SdJwtW3cVc | ClaimFormat.SdJwtW3cVp> {
  claimFormat: T
  compact: string
  header: W3cV2SdJwtHeader
  payload: W3cV2SdJwtPayload
  prettyClaims: W3cV2SdJwtPayload
  kbJwt?: {
    header: Record<string, unknown>
    payload: Record<string, unknown>
  }
}

export function sdJwtVcHasher(data: string | ArrayBufferLike, alg: string) {
  return Hasher.hash(typeof data === 'string' ? data : new Uint8Array(data), alg)
}

export function decodeSdJwt<T extends ClaimFormat.SdJwtW3cVc | ClaimFormat.SdJwtW3cVp>(
  compact: string,
  claimFormat: T
): W3cV2SdJwt<T> {
  const { jwt, disclosures, kbJwt } = decodeSdJwtSync(compact, sdJwtVcHasher)

  const header = jwt.header as W3cV2SdJwtHeader
  const payload = jwt.payload as W3cV2SdJwtPayload
  const prettyClaims = getClaimsSync(payload, disclosures, sdJwtVcHasher) as W3cV2SdJwtPayload

  if (!isJsonObject(prettyClaims)) {
    throw new CredoError('SD-JWT claims are not a valid JSON object')
  }

  return {
    claimFormat,
    compact,
    header,
    payload,
    prettyClaims,
    kbJwt,
  }
}
