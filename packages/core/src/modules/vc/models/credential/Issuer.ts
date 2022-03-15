import { IsUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface IssuerOptions {
  id: string
}

export class Issuer {
  public constructor(options: IssuerOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  public id!: string
}
