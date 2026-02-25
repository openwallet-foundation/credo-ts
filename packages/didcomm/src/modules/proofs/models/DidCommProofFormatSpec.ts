import { utils } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

export interface DidCommProofFormatSpecOptions {
  attachmentId?: string
  format: string
}

export class DidCommProofFormatSpec {
  public constructor(options: DidCommProofFormatSpecOptions) {
    if (options) {
      this.attachmentId = options.attachmentId ?? utils.uuid()
      this.format = options.format
    }
  }

  @Expose({ name: 'attach_id' })
  @IsString()
  public attachmentId!: string

  @IsString()
  public format!: string
}
