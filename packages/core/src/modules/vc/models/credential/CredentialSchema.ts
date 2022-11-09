import { IsString } from 'class-validator'

import { IsUri } from '../../../../utils/validators'

export interface CredentialSchemaOptions {
  id: string
  type: string
}

export class CredentialSchema {
  public constructor(options: CredentialSchemaOptions) {
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
