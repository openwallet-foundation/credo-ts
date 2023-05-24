import { IsString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

export interface W3cCredentialStatusOptions {
  id: string
  type: string
}

export class W3cCredentialStatus {
  public constructor(options: W3cCredentialStatusOptions) {
    if (options) {
      this.id = options.id
      this.type = options.type
    }
  }

  @IsUri()
  public id!: string

  @IsString()
  public type!: string
}
