import { CredoError } from '../../../../error'
import { PublicJwk } from '../../../kms'
import type { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020 = 'JsonWebKey2020'

type GetJsonWebKey2020Options = {
  did: string

  verificationMethodId?: string
  publicJwk: PublicJwk
}

/**
 * Get a JsonWebKey2020 verification method.
 */
export function getJsonWebKey2020(options: GetJsonWebKey2020Options) {
  const verificationMethodId = options.verificationMethodId ?? `${options.did}#${options.publicJwk.fingerprint}`

  return {
    id: verificationMethodId,
    type: VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    controller: options.did,
    publicKeyJwk: options.publicJwk.toJson(),
  }
}

/**
 * Check whether a verification method is a JsonWebKey2020 verification method.
 */
export function isJsonWebKey2020(
  verificationMethod: VerificationMethod
): verificationMethod is VerificationMethod & { type: 'JsonWebKey2020' } {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020
}

/**
 * Get a key from a JsonWebKey2020 verification method.
 */
export function getPublicJwkFromJsonWebKey2020(verificationMethod: VerificationMethod & { type: 'JsonWebKey2020' }) {
  if (!verificationMethod.publicKeyJwk) {
    throw new CredoError(
      `Missing publicKeyJwk on verification method with type ${VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020}`
    )
  }

  return PublicJwk.fromUnknown(verificationMethod.publicKeyJwk)
}
