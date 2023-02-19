import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

import { IndyRevocationInterval } from '../../../../credentials'

import { AttributeFilter } from './AttributeFilter'
import { PredicateType } from './PredicateType'

export interface ProofPredicateInfoOptions {
  name: string
  // Also allow string value of the enum as input, to make it easier to use in the API
  predicateType: PredicateType | `${PredicateType}`
  predicateValue: number
  nonRevoked?: IndyRevocationInterval
  restrictions?: AttributeFilter[]
}

export class ProofPredicateInfo {
  public constructor(options: ProofPredicateInfoOptions) {
    if (options) {
      this.name = options.name
      this.nonRevoked = options.nonRevoked ? new IndyRevocationInterval(options.nonRevoked) : undefined
      this.restrictions = options.restrictions?.map((r) => new AttributeFilter(r))
      this.predicateType = options.predicateType as PredicateType
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
