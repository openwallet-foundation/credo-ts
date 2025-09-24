import { plainToClassFromExist } from 'class-transformer'
import { IsString } from 'class-validator'
import { IsUri } from '../../../../utils'

export interface W3cV2CredentialSchemaOptions {
  id: string
  type: string
  [property: string]: unknown
}

/**
 * Represents a credential schema.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#data-schemas
 */
export class W3cV2CredentialSchema {
  public constructor(options: W3cV2CredentialSchemaOptions) {
    if (options) {
      const { id, type, ...rest } = options

      plainToClassFromExist(this, rest)

      this.id = options.id
      this.type = options.type
    }
  }

  @IsUri()
  public id!: string

  @IsString()
  public type!: string;

  [property: string]: unknown
}
