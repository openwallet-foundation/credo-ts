import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

export interface ProofFormatSpecOptions {
  attachmentId: string
  format: string
}

export class ProofFormatSpec {
  public constructor(options: ProofFormatSpecOptions) {
    if (options) {
      this.attachmentId = options.attachmentId
      this.format = options.format
    }
  }

  @Expose({ name: 'attach_id' })
  public attachmentId!: string

  @IsString()
  public format!: string
}
