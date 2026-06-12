import { instanceToPlain, plainToInstance, Transform, TransformationType } from 'class-transformer'
import { CredoError } from '../../../../error'
import type { SingleOrArray } from '../../../../types'
import type { AnonCredsVc1BridgeProofOptions } from '../../anoncreds-vc1-bridge/AnonCredsVc1BridgeProof'
import { AnonCredsVc1BridgeProof } from '../../anoncreds-vc1-bridge/AnonCredsVc1BridgeProof'
import { ANONCREDS_VC1_BRIDGE_CRYPTOSUITE } from '../../anoncreds-vc1-bridge/IAnonCredsVc1BridgeService'
import type { LinkedDataProofOptions } from '../models/LinkedDataProof'
import { LinkedDataProof } from '../models/LinkedDataProof'

export function ProofTransformer() {
  return Transform(
    ({
      value,
      type,
    }: {
      value: SingleOrArray<LinkedDataProofOptions | AnonCredsVc1BridgeProofOptions>
      type: TransformationType
    }) => {
      if (type === TransformationType.PLAIN_TO_CLASS) {
        const plainOptionsToClass = (v: LinkedDataProofOptions | AnonCredsVc1BridgeProofOptions) => {
          if ('cryptosuite' in v) {
            if (v.type !== 'DataIntegrityProof' || v.cryptosuite !== ANONCREDS_VC1_BRIDGE_CRYPTOSUITE) {
              throw new CredoError(
                `VC1 bridge proofs only support DataIntegrityProof with cryptosuite ${ANONCREDS_VC1_BRIDGE_CRYPTOSUITE}`
              )
            }

            return plainToInstance(AnonCredsVc1BridgeProof, v)
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
