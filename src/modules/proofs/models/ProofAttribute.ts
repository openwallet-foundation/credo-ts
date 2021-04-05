import { IsInt, IsPositive, IsString } from 'class-validator'
import { Expose } from 'class-transformer'

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
  @IsPositive()
  public subProofIndex!: number

  @IsString()
  public raw!: string

  @IsString()
  public encoded!: string
}
