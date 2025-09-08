import { plainToClassFromExist } from 'class-transformer'
import { IsString } from 'class-validator'

export interface W3cV2TermsOfUseOptions {
  type: string
  [property: string]: unknown
}

/**
 * Represents a terms of use.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#terms-of-use
 */
export class W3cV2TermsOfUse {
  public constructor(options: W3cV2TermsOfUseOptions) {
    if (options) {
      const { type, ...rest } = options

      this.type = type

      plainToClassFromExist(this, rest)
    }
  }

  @IsString()
  public type!: string;

  [property: string]: unknown
}
