import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { ProofAttribute } from './ProofAttribute'

export class RequestedProof {
  public constructor(options: RequestedProof) {
    if (options) {
      this.revealedAttributes = options.revealedAttributes
      this.selfAttestedAttributes = options.selfAttestedAttributes
    }
  }

  @Expose({ name: 'revealed_attrs' })
  @ValidateNested({ each: true })
  @Type(() => ProofAttribute)
  @IsInstance(ProofAttribute, { each: true })
  public revealedAttributes!: Map<string, ProofAttribute>

  @Expose({ name: 'self_attested_attrs' })
  @IsOptional()
  // Validation is relaxed/skipped because empty Map validation will fail on JSON transform validation
  public selfAttestedAttributes: Map<string, string> = new Map<string, string>()
}
