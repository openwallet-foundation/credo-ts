import { plainToClassFromExist } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import { IsUri } from '../../../../utils'

export interface W3cV2CredentialStatusOptions {
  id?: string
  type: string
  [property: string]: unknown
}

/**
 * Represents a credential status.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#status
 */
export class W3cV2CredentialStatus {
  public constructor(options: W3cV2CredentialStatusOptions) {
    if (options) {
      const { id, type, ...rest } = options

      this.id = id
      this.type = type

      plainToClassFromExist(this, rest)
    }
  }

  @IsOptional()
  @IsUri()
  public id?: string

  @IsString()
  public type!: string;

  [property: string]: unknown
}
