import { plainToClassFromExist } from 'class-transformer'
import { IsString } from 'class-validator'

export interface W3cV2RefreshServiceOptions {
  type: string
  [property: string]: unknown
}

/**
 * Represents a refresh service.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#refreshing
 */
export class W3cV2RefreshService {
  public constructor(options: W3cV2RefreshServiceOptions) {
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
