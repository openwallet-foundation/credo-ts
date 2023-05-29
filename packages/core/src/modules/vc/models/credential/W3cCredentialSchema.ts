import { IsString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

export interface W3cCredentialSchemaOptions {
  id: string
  type: string
}

export class W3cCredentialSchema {
  public constructor(options: W3cCredentialSchemaOptions) {
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
