import type { SingleOrArray } from '../../utils/type'
import type { W3cVerifiableCredentialOptions } from './models'
import type { CredentialSubjectOptions } from './models/credential/CredentialSubject'
import type { IssuerOptions } from './models/credential/Issuer'
import type { LinkedDataProofOptions } from './models/LinkedDataProof'

import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { isString } from 'class-validator'

import { W3cVerifiableCredential } from './models'
import { CredentialSubject } from './models/credential/CredentialSubject'
import { Issuer } from './models/credential/Issuer'
import { LinkedDataProof } from './models/LinkedDataProof'

export function IssuerTransformer() {
  return Transform(({ value, type }: { value: string | IssuerOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(Issuer, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}

export function CredentialSubjectTransformer() {
  return Transform(({ value, type }: { value: string | CredentialSubjectOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(CredentialSubject, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}

export function VerifiableCredentialTransformer() {
  return Transform(
    ({ value, type }: { value: SingleOrArray<W3cVerifiableCredentialOptions>; type: TransformationType }) => {
      if (type === TransformationType.PLAIN_TO_CLASS) {
        if (Array.isArray(value)) return value.map((v) => plainToInstance(W3cVerifiableCredential, v))
        return plainToInstance(W3cVerifiableCredential, value)
      } else if (type === TransformationType.CLASS_TO_PLAIN) {
        if (Array.isArray(value)) return value.map((v) => instanceToPlain(v))
        return instanceToPlain(value)
      }
      // PLAIN_TO_PLAIN
      return value
    }
  )
}

export function LinkedDataProofTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<LinkedDataProofOptions>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value)) return value.map((v) => plainToInstance(LinkedDataProof, v))
      return plainToInstance(LinkedDataProof, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map((v) => instanceToPlain(v))
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}
