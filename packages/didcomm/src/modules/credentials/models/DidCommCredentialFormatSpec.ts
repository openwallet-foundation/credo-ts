import { utils } from '@credo-ts/core'
import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

export interface DidCommCredentialFormatSpecOptions {
  attachmentId?: string
  format: string
}

export class DidCommCredentialFormatSpec {
  public constructor(options: DidCommCredentialFormatSpecOptions) {
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
