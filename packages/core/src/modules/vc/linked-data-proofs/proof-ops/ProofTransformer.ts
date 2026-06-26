import { instanceToPlain, plainToInstance, Transform, TransformationType } from 'class-transformer'
import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import type { AnonCredsW3cBridgeProofOptions } from '../../anoncreds-w3c-bridge'
import { ANONCREDS_W3C_BRIDGE_CRYPTOSUITE, AnonCredsW3cBridgeProof } from '../../anoncreds-w3c-bridge'
import type { LinkedDataProofOptions } from '../models/LinkedDataProof'
import { LinkedDataProof } from '../models/LinkedDataProof'

export function ProofTransformer() {
  return Transform(
    ({
      value,
      type,
    }: {
      value: SingleOrArray<LinkedDataProofOptions | AnonCredsW3cBridgeProofOptions>
      type: TransformationType
    }) => {
      if (type === TransformationType.PLAIN_TO_CLASS) {
        const plainOptionsToClass = (v: LinkedDataProofOptions | AnonCredsW3cBridgeProofOptions) => {
          if ('cryptosuite' in v) {
            if (v.type !== 'DataIntegrityProof' || v.cryptosuite !== ANONCREDS_W3C_BRIDGE_CRYPTOSUITE) {
              throw new CredoError(
                `W3C bridge proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_W3C_BRIDGE_CRYPTOSUITE}`
              )
            }

            return plainToInstance(AnonCredsW3cBridgeProof, v)
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
