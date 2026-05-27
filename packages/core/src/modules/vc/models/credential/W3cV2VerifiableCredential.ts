import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'
import { Jwt } from '../../../../crypto/jose/jwt/Jwt'
import { ClassValidationError, CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import {
  W3cV2DataIntegrityVerifiableCredential,
  type W3cV2DataIntegrityVerifiableCredentialOptions,
} from '../../data-integrity-v1'
import { W3cV2JwtVerifiableCredential, type W3cV2JwtVerifiableCredentialOptions } from '../../jwt-vc'
import { W3cV2SdJwtVerifiableCredential, type W3cV2SdJwtVerifiableCredentialOptions } from '../../sd-jwt-vc'
import { ClaimFormat } from '../ClaimFormat'

export const decodeW3cV2VerifiableCredential = (v: unknown) => {
  try {
    if (typeof v !== 'string') {
      throw new CredoError('Expected a plain string encoding')
    }

    const trimmedValue = v.trim()

    try {
      const parsedJson = JSON.parse(trimmedValue)
      if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
        return W3cV2DataIntegrityVerifiableCredential.fromObject(
          parsedJson as Record<string, unknown> & {
            proof: unknown
          }
        )
      }
    } catch {
      // Not JSON; continue with compact encodings.
    }

    const issuerSignedCompact = trimmedValue.split('~')[0]
    if (issuerSignedCompact !== trimmedValue && Jwt.format.test(issuerSignedCompact)) {
      try {
        const typ = Jwt.fromSerializedJwt(issuerSignedCompact).header.typ

        if (typ === 'vp+sd-jwt') {
          throw new CredoError('Value is a W3C SD-JWT VP, but a W3C SD-JWT VC was expected')
        }

        if (!typ || typ === 'vc+sd-jwt' || typ === 'dc+sd-jwt') {
          return W3cV2SdJwtVerifiableCredential.fromCompact(trimmedValue)
        }
      } catch (error) {
        if (error instanceof CredoError && error.message.includes('W3C SD-JWT VP')) {
          throw error
        }

        // Unable to classify SD-JWT type using compact header, continue with JWT.
      }
    }

    return W3cV2JwtVerifiableCredential.fromCompact(trimmedValue)
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ClassValidationError) {
      throw error
    }

    throw new CredoError(`Value '${v}' is not a valid W3cV2VerifiableCredential. ${error.message}`)
  }
}

const encodeCredential = (v: unknown) => {
  if (v instanceof W3cV2JwtVerifiableCredential) {
    return v.encoded
  }

  if (v instanceof W3cV2SdJwtVerifiableCredential) {
    return v.encoded
  }

  if (v instanceof W3cV2DataIntegrityVerifiableCredential) {
    return v.encoded
  }

  throw new CredoError(`Value '${v}' is not a valid W3cV2VerifiableCredential`)
}

export function W3cV2VerifiableCredentialTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value) ? value.map(decodeW3cV2VerifiableCredential) : decodeW3cV2VerifiableCredential(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map(encodeCredential)
      return encodeCredential(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

/**
 * A Secured W3C Verifiable Credential (VC) as defined in the W3C VC Data Model 2.0
 * and secured according to the VC-JOSE-COSE specification.
 *
 * It can be one of:
 * - A verifiable credential encoded as a JWT.
 * - A verifiable credential encoded as a SD-JWT.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 * @see https://www.w3.org/TR/vc-jose-cose/
 *
 * TODO: add support for embedded proof mechanisms (Verifiable Credential Data Integrity 1.0)
 */
export type W3cV2VerifiableCredential<
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVc
  ? W3cV2JwtVerifiableCredential
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtVerifiableCredential
    : Format extends ClaimFormat.DiVc
      ? W3cV2DataIntegrityVerifiableCredential
      : W3cV2JwtVerifiableCredential | W3cV2SdJwtVerifiableCredential | W3cV2DataIntegrityVerifiableCredential

export type W3cV2VerifiableCredentialOptions<
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVc
  ? W3cV2JwtVerifiableCredentialOptions
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtVerifiableCredentialOptions
    : Format extends ClaimFormat.DiVc
      ? W3cV2DataIntegrityVerifiableCredentialOptions
      :
          | W3cV2JwtVerifiableCredentialOptions
          | W3cV2SdJwtVerifiableCredentialOptions
          | W3cV2DataIntegrityVerifiableCredentialOptions
