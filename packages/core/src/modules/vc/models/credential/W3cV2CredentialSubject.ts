import { plainToClassFromExist } from 'class-transformer'
import { IsOptional } from 'class-validator'
import { IsUri } from '../../../../utils'

export interface W3cV2CredentialSubjectOptions {
  id?: string
  [property: string]: unknown
}

/**
 * Represents a credential subject.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#credential-subject
 */
export class W3cV2CredentialSubject {
  public constructor(options: W3cV2CredentialSubjectOptions) {
    if (options) {
      const { id, ...rest } = options

      this.id = id

      plainToClassFromExist(this, rest)
    }
  }

  @IsOptional()
  @IsUri()
  public id?: string;

  [property: string]: unknown
}
