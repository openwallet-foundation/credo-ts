import { instanceToPlain, plainToInstance, Transform, TransformationType } from 'class-transformer'
import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import type { AnonCredsW3cCredentialProofOptions } from '../../anoncreds-w3c-credential'
import { ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE, AnonCredsW3cCredentialProof } from '../../anoncreds-w3c-credential'
import type { LinkedDataProofOptions } from '../models/LinkedDataProof'
import { LinkedDataProof } from '../models/LinkedDataProof'

export function ProofTransformer() {
  return Transform(
    ({
      value,
      type,
    }: {
      value: SingleOrArray<LinkedDataProofOptions | AnonCredsW3cCredentialProofOptions>
      type: TransformationType
    }) => {
      if (type === TransformationType.PLAIN_TO_CLASS) {
        const plainOptionsToClass = (v: LinkedDataProofOptions | AnonCredsW3cCredentialProofOptions) => {
          if ('cryptosuite' in v) {
            if (v.type !== 'DataIntegrityProof' || v.cryptosuite !== ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE) {
              throw new CredoError(
                `W3C credential proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE}`
              )
            }

            return plainToInstance(AnonCredsW3cCredentialProof, v)
          }
          return plainToInstance(LinkedDataProof, v)
        }

        if (Array.isArray(value)) return value.map(plainOptionsToClass)
        return plainOptionsToClass(value)
      }
      if (type === TransformationType.CLASS_TO_PLAIN) {
        if (Array.isArray(value)) return value.map((v) => instanceToPlain(v))
        return instanceToPlain(value)
      }
      // PLAIN_TO_PLAIN
      return value
    }
  )
}
