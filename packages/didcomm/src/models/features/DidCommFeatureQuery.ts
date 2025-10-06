import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

export interface DidCommFeatureQueryOptions {
  featureType: string
  match: string
}

export class DidCommFeatureQuery {
  public constructor(options: DidCommFeatureQueryOptions) {
    if (options) {
      this.featureType = options.featureType
      this.match = options.match
    }
  }

  @Expose({ name: 'feature-type' })
  @IsString()
  public featureType!: string

  @IsString()
  public match!: string
}
