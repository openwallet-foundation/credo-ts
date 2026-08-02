import { instanceToPlain, plainToInstance, Transform, TransformationType } from 'class-transformer'
import type { SingleOrArray } from '../../../../types'
import type { DataIntegrityProofOptions } from '../models/DataIntegrityProof'
import { DataIntegrityProof } from '../models/DataIntegrityProof'
import type { LinkedDataProofOptions } from '../models/LinkedDataProof'
import { LinkedDataProof } from '../models/LinkedDataProof'

export function ProofTransformer() {
  return Transform(
    ({
      value,
      type,
    }: {
      value: SingleOrArray<LinkedDataProofOptions | DataIntegrityProofOptions>
      type: TransformationType
    }) => {
      if (type === TransformationType.PLAIN_TO_CLASS) {
        const plainOptionsToClass = (v: LinkedDataProofOptions | DataIntegrityProofOptions) => {
          if ('cryptosuite' in v) {
            return plainToInstance(DataIntegrityProof, v)
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
