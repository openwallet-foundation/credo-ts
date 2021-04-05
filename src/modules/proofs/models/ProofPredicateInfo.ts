import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AttributeFilter } from './AttributeFilter'
import { PredicateType } from './PredicateType'
import { RevocationInterval } from '../../credentials'

export class ProofPredicateInfo {
  public constructor(options: ProofPredicateInfo) {
    if (options) {
      this.name = options.name
      this.nonRevoked = options.nonRevoked
      this.restrictions = options.restrictions
      this.predicateType = options.predicateType
      this.predicateValue = options.predicateValue
    }
  }

  @IsString()
  public name!: string

  @Expose({ name: 'p_type' })
  @IsEnum(PredicateType)
  public predicateType!: PredicateType

  @Expose({ name: 'p_value' })
  @IsInt()
  public predicateValue!: number

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @Type(() => RevocationInterval)
  @IsOptional()
  public nonRevoked?: RevocationInterval

  @ValidateNested({ each: true })
  @Type(() => AttributeFilter)
  @IsOptional()
  @IsArray()
  public restrictions?: AttributeFilter[]
}
