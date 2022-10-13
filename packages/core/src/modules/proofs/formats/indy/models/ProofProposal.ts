import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { PresentationPreviewAttribute } from '../../../protocol/v1/models/V1PresentationPreview'

export interface IndyProofProposal {
  name: string
  version: string
  nonce: string
  requested_attributes: {
    [key: string]: {
      name?: string | undefined
      names?: string | undefined
    }
  }
  requested_predicates: {
    [key: string]: {
      name: string
      p_type: '>=' | '>' | '<=' | '<'
      p_value: number
    }
  }
}
export interface ProofProposalOptions {
  name?: string
  version?: string
  nonce?: string
  requestedAttributes?: PresentationPreviewAttribute[]
  requestedPredicates?: PresentationPreviewAttribute[]
}

/**
 * Proof Proposal for Indy based proof format
 *
 */
export class ProofProposal {
  public constructor(options: ProofProposalOptions) {
    if (options) {
      this.name = options.name
      this.version = options.version
      this.nonce = options.nonce
      if (options.requestedAttributes) {
        this.requestedAttributes = options.requestedAttributes
      }
      if (options.requestedPredicates) {
        this.requestedPredicates = options.requestedPredicates
      }
    }
  }

  @IsString()
  @IsOptional()
  public name?: string

  @IsString()
  @IsOptional()
  public version?: string

  @IsString()
  @IsOptional()
  public nonce?: string

  @Expose({ name: 'requested_attributes' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PresentationPreviewAttribute)
  @IsInstance(PresentationPreviewAttribute, { each: true })
  public requestedAttributes!: PresentationPreviewAttribute[]

  @Expose({ name: 'requested_predicates' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PresentationPreviewAttribute)
  @IsInstance(PresentationPreviewAttribute, { each: true })
  public requestedPredicates!: PresentationPreviewAttribute[]
}
