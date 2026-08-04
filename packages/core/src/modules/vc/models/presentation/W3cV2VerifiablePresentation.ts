import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'
import { Jwt } from '../../../../crypto/jose/jwt/Jwt'
import { ClassValidationError, CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { JsonTransformer } from '../../../../utils'
import {
  W3cV2DataIntegrityVerifiablePresentation,
  type W3cV2DataIntegrityVerifiablePresentationOptions,
} from '../../data-integrity-v1'
import {
  W3cV2JwtVerifiablePresentation,
  type W3cV2JwtVerifiablePresentationOptions,
} from '../../jwt-vc/W3cV2JwtVerifiablePresentation'
import {
  W3cV2SdJwtVerifiablePresentation,
  type W3cV2SdJwtVerifiablePresentationOptions,
} from '../../sd-jwt-vc/W3cV2SdJwtVerifiablePresentation'
import { ClaimFormat } from '../ClaimFormat'
import { presentationFromDataUri } from './W3cV2EnvelopedVerifiablePresentationCodec'
import { isEmbeddedDataIntegrityPresentationEntry, W3cV2Presentation } from './W3cV2Presentation'

export const decodeW3cV2VerifiablePresentation = (value: unknown) => {
  try {
    if (typeof value !== 'string') {
      throw new CredoError('Expected a plain string encoding')
    }

    const trimmedValue = value.trim()

    try {
      const parsedJson = JSON.parse(trimmedValue)
      if (isEmbeddedDataIntegrityPresentationEntry(parsedJson)) {
        return new W3cV2DataIntegrityVerifiablePresentation({
          securedPresentation: parsedJson,
          resolvedPresentation: JsonTransformer.fromJSON(parsedJson, W3cV2Presentation, { validate: false }),
        })
      }
    } catch {
      // Not JSON; continue with envelope/compact encodings.
    }

    if (trimmedValue.startsWith('data:')) return presentationFromDataUri(trimmedValue)

    const issuerSignedCompact = trimmedValue.split('~')[0]
    if (issuerSignedCompact !== trimmedValue) {
      if (!Jwt.format.test(issuerSignedCompact)) {
        throw new CredoError("Unsupported presentation string encoding. Expected compact 'vp+sd-jwt'.")
      }

      const typ = Jwt.fromSerializedJwt(issuerSignedCompact).header.typ

      if (typ === 'vc+sd-jwt' || typ === 'dc+sd-jwt') {
        throw new CredoError('Value is a W3C SD-JWT VC, but a W3C SD-JWT VP was expected')
      }

      if (typ && typ !== 'vp+sd-jwt') {
        throw new CredoError(`Unsupported W3C SD-JWT VP typ '${typ}'. Expected 'vp+sd-jwt'.`)
      }

      return W3cV2SdJwtVerifiablePresentation.fromCompact(trimmedValue)
    }

    if (!Jwt.format.test(trimmedValue)) {
      throw new CredoError("Unsupported presentation string encoding. Expected compact 'vp+jwt'.")
    }

    const typ = Jwt.fromSerializedJwt(trimmedValue).header.typ

    if (typ === 'vc+jwt' || typ === 'dc+jwt') {
      throw new CredoError('Value is a W3C VC JWT, but a W3C VP JWT was expected')
    }

    if (typ === 'vp+sd-jwt') {
      throw new CredoError("Value has typ 'vp+sd-jwt' but is missing SD-JWT disclosures")
    }

    if (typ && typ !== 'vp+jwt') {
      throw new CredoError(`Unsupported W3C VP JWT typ '${typ}'. Expected 'vp+jwt'.`)
    }

    return W3cV2JwtVerifiablePresentation.fromCompact(trimmedValue)
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ClassValidationError) {
      throw error
    }

    throw new CredoError(`Value '${value}' is not a valid W3cV2VerifiablePresentation. ${error.message}`)
  }
}

const encodePresentation = (value: unknown) => {
  if (value instanceof W3cV2JwtVerifiablePresentation) {
    return value.encoded
  }

  if (value instanceof W3cV2SdJwtVerifiablePresentation) {
    return value.encoded
  }

  if (value instanceof W3cV2DataIntegrityVerifiablePresentation) {
    return value.encoded
  }

  throw new CredoError(`Value '${value}' is not a valid W3cV2VerifiablePresentation`)
}

export function W3cV2VerifiablePresentationTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value)
        ? value.map(decodeW3cV2VerifiablePresentation)
        : decodeW3cV2VerifiablePresentation(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map(encodePresentation)
      return encodePresentation(value)
    }

    return value
  })
}

/**
 * A Secured W3C Verifiable Presentation (VP) as defined in the W3C VC Data Model 2.0
 * and secured according to VC-JOSE-COSE and VC Data Integrity specifications.
 *
 * It can be one of:
 * - A Verifiable Presentation encoded as a JWT.
 * - A Verifiable Presentation encoded as a SD-JWT.
 * - A Verifiable Presentation with embedded Data Integrity proof(s).
 *
 * This can be further enveloped using a {@link W3cV2EnvelopedVerifiablePresentation}.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 * @see https://www.w3.org/TR/vc-jose-cose/
 * @see https://www.w3.org/TR/vc-data-integrity/
 *
 */
export type W3cV2VerifiablePresentation<
  Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVp
  ? W3cV2JwtVerifiablePresentation
  : Format extends ClaimFormat.SdJwtW3cVp
    ? W3cV2SdJwtVerifiablePresentation
    : Format extends ClaimFormat.DiVp
      ? W3cV2DataIntegrityVerifiablePresentation
      : W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation | W3cV2DataIntegrityVerifiablePresentation

export type W3cV2VerifiablePresentationOptions<
  Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVp
  ? W3cV2JwtVerifiablePresentationOptions
  : Format extends ClaimFormat.SdJwtW3cVp
    ? W3cV2SdJwtVerifiablePresentationOptions
    : Format extends ClaimFormat.DiVp
      ? W3cV2DataIntegrityVerifiablePresentationOptions
      :
          | W3cV2SdJwtVerifiablePresentationOptions
          | W3cV2JwtVerifiablePresentationOptions
          | W3cV2DataIntegrityVerifiablePresentationOptions
