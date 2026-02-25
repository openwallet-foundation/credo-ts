import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'
import { ClassValidationError, CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { W3cV2JwtVerifiableCredential, type W3cV2JwtVerifiableCredentialOptions } from '../../jwt-vc'
import { W3cV2SdJwtVerifiableCredential, type W3cV2SdJwtVerifiableCredentialOptions } from '../../sd-jwt-vc'
import { ClaimFormat } from '../ClaimFormat'

const decodeCredential = (v: unknown) => {
  try {
    if (typeof v !== 'string') {
      throw new CredoError('Expected a plain string encoding')
    }

    if (v.includes('~')) {
      return W3cV2SdJwtVerifiableCredential.fromCompact(v)
    }

    return W3cV2JwtVerifiableCredential.fromCompact(v)
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

  throw new CredoError(`Value '${v}' is not a valid W3cV2VerifiableCredential`)
}

export function W3cV2VerifiableCredentialTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value) ? value.map(decodeCredential) : decodeCredential(value)
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
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | unknown = unknown,
> = Format extends ClaimFormat.JwtVc
  ? W3cV2JwtVerifiableCredential
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtVerifiableCredential
    : W3cV2JwtVerifiableCredential | W3cV2SdJwtVerifiableCredential

export type W3cV2VerifiableCredentialOptions<
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | unknown = unknown,
> = Format extends ClaimFormat.JwtVc
  ? W3cV2JwtVerifiableCredentialOptions
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtVerifiableCredentialOptions
    : W3cV2JwtVerifiableCredentialOptions | W3cV2SdJwtVerifiableCredentialOptions
