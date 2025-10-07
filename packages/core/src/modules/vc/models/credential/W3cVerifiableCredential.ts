import type { ClaimFormat } from '../ClaimFormat'

import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'

import { ClassValidationError, CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import { JsonTransformer } from '../../../../utils'
import { W3cJsonLdVerifiableCredential } from '../../data-integrity/models/W3cJsonLdVerifiableCredential'
import { W3cJwtVerifiableCredential } from '../../jwt-vc/W3cJwtVerifiableCredential'

const getCredential = (v: unknown) => {
  try {
    return typeof v === 'string'
      ? W3cJwtVerifiableCredential.fromSerializedJwt(v)
      : // Validation is done separately
        JsonTransformer.fromJSON(v, W3cJsonLdVerifiableCredential, { validate: false })
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ClassValidationError) throw error
    throw new CredoError(`value '${v}' is not a valid W3cJwtVerifiableCredential. ${error.message}`)
  }
}

const getEncoded = (v: unknown) =>
  v instanceof W3cJwtVerifiableCredential ? v.serializedJwt : JsonTransformer.toJSON(v)

export function W3cVerifiableCredentialTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value) ? value.map(getCredential) : getCredential(value)
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map(getEncoded)
      return getEncoded(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}

export type W3cVerifiableCredential<Format extends ClaimFormat.JwtVc | ClaimFormat.LdpVc | unknown = unknown> =
  Format extends ClaimFormat.JwtVc
    ? W3cJwtVerifiableCredential
    : Format extends ClaimFormat.LdpVc
      ? W3cJsonLdVerifiableCredential
      : W3cJsonLdVerifiableCredential | W3cJwtVerifiableCredential
