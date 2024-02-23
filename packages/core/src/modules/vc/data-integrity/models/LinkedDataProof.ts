import { IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'

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
  cryptosuite?: never
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

  @IsUri()
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
