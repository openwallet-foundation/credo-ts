import { Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { ProofIdentifier } from './ProofIdentifier'
import { RequestedProof } from './RequestedProof'

export class PartialProof {
  public constructor(options: PartialProof) {
    if (options) {
      this.identifiers = options.identifiers
    }
  }

  @Type(() => ProofIdentifier)
  @ValidateNested({ each: true })
  public identifiers!: ProofIdentifier[]

  @Expose({ name: 'requested_proof' })
  @Type(() => RequestedProof)
  @ValidateNested()
  public requestedProof!: RequestedProof
}
