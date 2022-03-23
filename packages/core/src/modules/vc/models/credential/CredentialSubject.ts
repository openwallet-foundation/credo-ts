import { IsUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface CredentialSubjectOptions {
  id: string
  [key: string]: unknown
}

export class CredentialSubject {
  public constructor(options: CredentialSubjectOptions) {
    if (options) {
      this.id = options.id
      this.key = options.key
    }
  }
  [key: string]: unknown

  @IsUri()
  public id!: string
}
