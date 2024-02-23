import { IsEnum, IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../../utils'

export interface DataIntegrityProofOptions {
  type: string
  cryptosuite: string
  verificationMethod: string
  proofPurpose: string
  domain?: string
  challenge?: string
  nonce?: string
  created?: string
  expires?: string
  proofValue?: string
  previousProof?: string
}

/**
 * Linked Data Proof
 * @see https://w3c.github.io/vc-data-model/#proofs-signatures
 *
 * @class LinkedDataProof
 */
export class DataIntegrityProof {
  public constructor(options: DataIntegrityProofOptions) {
    if (options) {
      this.type = options.type
      this.cryptosuite = options.cryptosuite
      this.verificationMethod = options.verificationMethod
      this.proofPurpose = options.proofPurpose
      this.domain = options.domain
      this.challenge = options.challenge
      this.nonce = options.nonce
      this.created = options.created
      this.expires = options.expires
      this.proofValue = options.proofValue
      this.previousProof = options.previousProof
    }
  }

  @IsString()
  @IsEnum(['DataIntegrityProof'])
  public type!: string

  @IsString()
  public cryptosuite!: string

  @IsString()
  public proofPurpose!: string

  @IsString()
  public verificationMethod!: string

  @IsUri()
  @IsOptional()
  public domain?: string

  @IsString()
  @IsOptional()
  public challenge?: string

  @IsString()
  @IsOptional()
  public nonce?: string

  @IsString()
  @IsOptional()
  public created?: string

  @IsString()
  @IsOptional()
  public expires?: string

  @IsString()
  @IsOptional()
  public proofValue?: string

  @IsString()
  @IsOptional()
  public previousProof?: string
}
