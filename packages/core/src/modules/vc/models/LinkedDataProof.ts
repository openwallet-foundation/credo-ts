import type { SingleOrArray } from '../../../utils/type'

import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export interface LinkedDataProofOptions {
  type: string
  proofPurpose: string
  verificationMethod: string
  created: string
  domain?: string
  challenge?: string
  jws?: string
  proofValue?: string
  nonce?: string
}

/**
 * Linked Data Proof
 * @see https://w3c.github.io/vc-data-model/#proofs-signatures
 *
 * @class LinkedDataProof
 */
export class LinkedDataProof {
  public constructor(options: LinkedDataProofOptions) {
    if (options) {
      this.type = options.type
      this.proofPurpose = options.proofPurpose
      this.verificationMethod = options.verificationMethod
      this.created = options.created
      this.domain = options.domain
      this.challenge = options.challenge
      this.jws = options.jws
      this.proofValue = options.proofValue
      this.nonce = options.nonce
    }
  }

  @IsString()
  public type!: string

  @IsString()
  public proofPurpose!: string

  @IsString()
  public verificationMethod!: string

  @IsString()
  public created!: string

  @IsString()
  @IsOptional()
  public domain?: string

  @IsString()
  @IsOptional()
  public challenge?: string

  @IsString()
  @IsOptional()
  public jws?: string

  @IsString()
  @IsOptional()
  public proofValue?: string

  @IsString()
  @IsOptional()
  public nonce?: string
}

// Custom transformers

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
