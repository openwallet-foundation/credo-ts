import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

import { IndyRevocationInterval } from '../../../../credentials'

import { AttributeFilter } from './AttributeFilter'
import { PredicateType } from './PredicateType'

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
  @Type(() => IndyRevocationInterval)
  @IsOptional()
  @IsInstance(IndyRevocationInterval)
  public nonRevoked?: IndyRevocationInterval

  @ValidateNested({ each: true })
  @Type(() => AttributeFilter)
  @IsOptional()
  @IsInstance(AttributeFilter, { each: true })
  @IsArray()
  public restrictions?: AttributeFilter[]
}
