import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'
import { ClassValidationError, CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import {
  W3cV2DataIntegrityVerifiablePresentation,
  type W3cV2DataIntegrityVerifiablePresentationOptions,
} from '../../data-integrity-v1'
import { W3cV2JwtVerifiablePresentation, type W3cV2JwtVerifiablePresentationOptions } from '../../jwt-vc'
import { W3cV2SdJwtVerifiablePresentation, type W3cV2SdJwtVerifiablePresentationOptions } from '../../sd-jwt-vc'
import { ClaimFormat } from '../ClaimFormat'

export const decodeW3cV2EnvelopedVerifiablePresentation = (value: string) => {
  if (!value.startsWith('data:')) {
    throw new CredoError('Invalid Enveloped Verifiable Presentation: "id" is not a valid data URI')
  }

  const mimetypeData = value.slice(5)
  const commaIndex = mimetypeData.indexOf(',')
  if (commaIndex === -1) {
    throw new CredoError('Invalid Enveloped Verifiable Presentation: "id" data URI is missing comma separator')
  }

  const mimetype = mimetypeData.slice(0, commaIndex)
  const data = mimetypeData.slice(commaIndex + 1)

  switch (mimetype) {
    case 'application/vp+sd-jwt':
      return W3cV2SdJwtVerifiablePresentation.fromCompact(data)

    case 'application/vp+jwt':
      return W3cV2JwtVerifiablePresentation.fromCompact(data)

    default:
      throw new CredoError(`Unsupported Enveloped Verifiable Presentation: ${mimetype} not recognized`)
  }
}

export const decodeW3cV2VerifiablePresentation = (value: unknown) => {
  try {
    if (typeof value !== 'string') {
      throw new CredoError('Expected a plain string encoding')
    }

    const trimmedValue = value.trim()

    try {
      const parsedJson = JSON.parse(trimmedValue)
      if (isEmbeddedDataIntegrityPresentation(parsedJson)) {
        return W3cV2DataIntegrityVerifiablePresentation.fromObject(parsedJson)
      }
    } catch {
      // Not JSON; continue with envelope/compact encodings.
    }

    if (trimmedValue.startsWith('data:')) return decodeW3cV2EnvelopedVerifiablePresentation(trimmedValue)

    try {
      return W3cV2JwtVerifiablePresentation.fromCompact(trimmedValue)
    } catch {
      // Not a VP JWT compact string; continue with VP SD-JWT.
    }

    try {
      return W3cV2SdJwtVerifiablePresentation.fromCompact(trimmedValue)
    } catch {
      throw new CredoError("Unsupported presentation string encoding. Expected compact 'vp+jwt' or 'vp+sd-jwt'.")
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ClassValidationError) {
      throw error
    }

    throw new CredoError(`Value '${value}' is not a valid W3cV2VerifiablePresentation. ${error.message}`)
  }
}

function isEmbeddedDataIntegrityPresentation(
  value: unknown
): value is W3cV2DataIntegrityVerifiablePresentationOptions['securedPresentation'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return 'proof' in value
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
 * and secured according to the VC-JOSE-COSE specification.
 *
 * It can be one of:
 * - An Verifiable Presentation encoded as a JWT.
 * - An Verifiable Presentation encoded as a SD-JWT.
 *
 * This can be further enveloped using a {@link W3cV2EnvelopedVerifiablePresentation}.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 * @see https://www.w3.org/TR/vc-jose-cose/
 *
 * TODO: add support for embedded proof mechanisms (Verifiable Credential Data Integrity 1.0)
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
