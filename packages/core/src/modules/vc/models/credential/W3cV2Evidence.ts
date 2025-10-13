import { plainToClassFromExist } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import { IsUri } from '../../../../utils'

export interface W3cV2EvidenceOptions {
  id?: string
  type: string
  [property: string]: unknown
}

/**
 * Represents an evidence.
 *
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#evidence
 */
export class W3cV2Evidence {
  public constructor(options: W3cV2EvidenceOptions) {
    if (options) {
      const { id, type, ...rest } = options

      plainToClassFromExist(this, rest)

      this.id = id
      this.type = type
    }
  }

  @IsOptional()
  @IsUri()
  public id?: string

  @IsString()
  public type!: string;

  [property: string]: unknown
}
