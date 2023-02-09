import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { uuid } from '../../../utils/uuid'

export interface CredentialFormatSpecOptions {
  attachmentId?: string
  format: string
}

export class CredentialFormatSpec {
  public constructor(options: CredentialFormatSpecOptions) {
    if (options) {
      this.attachmentId = options.attachmentId ?? uuid()
      this.format = options.format
    }
  }

  @Expose({ name: 'attach_id' })
  @IsString()
  public attachmentId!: string

  @IsString()
  public format!: string
}
