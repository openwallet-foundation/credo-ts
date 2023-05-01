import type { VerificationMethod } from './VerificationMethod'
import type { Jwk } from '../../../../crypto'

import { Key } from '../../../../crypto'

export const VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020 = 'JsonWebKey2020'

type JwkOrKey = { jwk: Jwk; key?: never } | { key: Key; jwk?: never }
type GetJsonWebKey2020VerificationMethodOptions = {
  did: string

  verificationMethodId?: string
} & JwkOrKey

export function getJsonWebKey2020VerificationMethod({
  did,
  key,
  jwk,
  verificationMethodId,
}: GetJsonWebKey2020VerificationMethodOptions) {
  if (!verificationMethodId) {
    const k = key ?? Key.fromJwk(jwk)
    verificationMethodId = `${did}#${k.fingerprint}`
  }

  return {
    id: verificationMethodId,
    type: VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    controller: did,
    publicKeyJwk: jwk ?? key.toJwk(),
  }
}

export function isJsonWebKey2020(verificationMethod: VerificationMethod) {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020
}
