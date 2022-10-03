import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { uuid } from '../../../utils/uuid'

export interface CredentialFormatSpecOptions {
  attachId?: string
  format: string
}

export class CredentialFormatSpec {
  public constructor(options: CredentialFormatSpecOptions) {
    if (options) {
      this.attachId = options.attachId ?? uuid()
      this.format = options.format
    }
  }

  @Expose({ name: 'attach_id' })
  @IsString()
  public attachId!: string

  @IsString()
  public format!: string
}
