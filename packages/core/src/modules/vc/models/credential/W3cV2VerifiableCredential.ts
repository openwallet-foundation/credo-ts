import { Transform, TransformationType } from 'class-transformer'
import { ValidationError } from 'class-validator'
import { ClassValidationError, CredoError } from '../../../../error'
import { SingleOrArray } from '../../../../types'
import { JsonTransformer } from '../../../../utils'
import { W3cV2EnvelopedVerifiableCredential } from './W3cV2EnvelopedVerifiableCredential'

const decodeCredential = (v: unknown) => {
  try {
    return JsonTransformer.fromJSON(v, W3cV2EnvelopedVerifiableCredential)
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ClassValidationError) throw error
    throw new CredoError(`value '${v}' is not a valid W3cV2VerifiableCredential. ${error.message}`)
  }
}

const encodeCredential = (v: unknown) => JsonTransformer.toJSON(v)

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
 * A W3C Verifiable Credential (VC) as defined in the W3C VC Data Model 2.0.
 *
 * It can either be an Enveloped Verifiable Credential or a Verifiable Credential
 * with an embedded proof. At the moment, Credo only supports Enveloped Verifiable
 * Credentials.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#securing-mechanisms
 *
 * TODO: add support for VCs with embedded proofs.
 */
export type W3cV2VerifiableCredential = W3cV2EnvelopedVerifiableCredential
