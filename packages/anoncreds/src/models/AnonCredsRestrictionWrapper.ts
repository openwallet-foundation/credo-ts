import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { AnonCredsRestrictionTransformer, AnonCredsRestriction } from './AnonCredsRestriction'

export class AnonCredsRestrictionWrapper {
  @ValidateNested({ each: true })
  @Type(() => AnonCredsRestriction)
  @AnonCredsRestrictionTransformer()
  public restrictions!: AnonCredsRestriction[]
}
