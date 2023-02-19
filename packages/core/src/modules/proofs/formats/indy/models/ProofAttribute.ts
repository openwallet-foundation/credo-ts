import { Expose } from 'class-transformer'
import { IsInt, IsString } from 'class-validator'

export class ProofAttribute {
  public constructor(options: ProofAttribute) {
    if (options) {
      this.subProofIndex = options.subProofIndex
      this.raw = options.raw
      this.encoded = options.encoded
    }
  }

  @Expose({ name: 'sub_proof_index' })
  @IsInt()
  public subProofIndex!: number

  @IsString()
  public raw!: string

  @IsString()
  public encoded!: string
}
