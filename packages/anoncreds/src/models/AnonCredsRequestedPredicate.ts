import type { AnonCredsRestrictionOptions } from './AnonCredsRestriction'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsIn, IsInstance, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

import { type AnonCredsPredicateType, anonCredsPredicateType } from '../models'

import { AnonCredsRestriction, AnonCredsRestrictionTransformer } from './AnonCredsRestriction'
import { AnonCredsRevocationInterval } from './AnonCredsRevocationInterval'

export interface AnonCredsRequestedPredicateOptions {
  name: string
  // Also allow string value of the enum as input, to make it easier to use in the API
  predicateType: AnonCredsPredicateType
  predicateValue: number
  nonRevoked?: AnonCredsRevocationInterval
  restrictions?: AnonCredsRestrictionOptions[]
}

export class AnonCredsRequestedPredicate {
  public constructor(options: AnonCredsRequestedPredicateOptions) {
    if (options) {
      this.name = options.name
      this.nonRevoked = options.nonRevoked ? new AnonCredsRevocationInterval(options.nonRevoked) : undefined
      this.restrictions = options.restrictions?.map((r) => new AnonCredsRestriction(r))
      this.predicateType = options.predicateType as AnonCredsPredicateType
      this.predicateValue = options.predicateValue
    }
  }

  @IsString()
  public name!: string

  @Expose({ name: 'p_type' })
  @IsIn(anonCredsPredicateType)
  public predicateType!: AnonCredsPredicateType

  @Expose({ name: 'p_value' })
  @IsInt()
  public predicateValue!: number

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @Type(() => AnonCredsRevocationInterval)
  @IsOptional()
  @IsInstance(AnonCredsRevocationInterval)
  public nonRevoked?: AnonCredsRevocationInterval

  @ValidateNested({ each: true })
  @Type(() => AnonCredsRestriction)
  @IsOptional()
  @IsArray()
  @AnonCredsRestrictionTransformer()
  public restrictions?: AnonCredsRestriction[]
}
