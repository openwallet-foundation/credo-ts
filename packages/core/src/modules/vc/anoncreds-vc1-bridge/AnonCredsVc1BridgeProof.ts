import { IsEnum, IsOptional, IsString } from 'class-validator'

import { IsUri } from '../../../utils/validators'

export interface AnonCredsVc1BridgeProofOptions {
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
 * VC1 anoncreds compatibility proof model.
 *
 * Represents a `DataIntegrityProof`-shaped wire payload used by the anoncreds VC1 bridge,
 * while keeping the bridge-specific model separate from true linked-data proof types.
 */
export class AnonCredsVc1BridgeProof {
  public constructor(options: AnonCredsVc1BridgeProofOptions) {
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
