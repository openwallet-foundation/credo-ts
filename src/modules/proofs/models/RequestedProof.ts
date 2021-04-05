import { IsString, ValidateNested } from 'class-validator'
import { Expose, Type } from 'class-transformer'

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
  public revealedAttributes!: Map<string, ProofAttribute>

  @Expose({ name: 'self_attested_attrs' })
  @IsString({ each: true })
  public selfAttestedAttributes!: Map<string, string>
}
