import { Expose, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsInstance, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator'
import type { AnonCredsRestrictionOptions } from './AnonCredsRestriction'

import { AnonCredsRestriction, AnonCredsRestrictionTransformer } from './AnonCredsRestriction'
import { AnonCredsRevocationInterval } from './AnonCredsRevocationInterval'

export interface AnonCredsRequestedAttributeOptions {
  name?: string
  names?: string[]
  nonRevoked?: AnonCredsRevocationInterval
  restrictions?: AnonCredsRestrictionOptions[]
}

export class AnonCredsRequestedAttribute {
  public constructor(options: AnonCredsRequestedAttributeOptions) {
    if (options) {
      this.name = options.name
      this.names = options.names
      this.nonRevoked = options.nonRevoked ? new AnonCredsRevocationInterval(options.nonRevoked) : undefined
      this.restrictions = options.restrictions?.map((r) => new AnonCredsRestriction(r))
    }
  }

  @IsString()
  @ValidateIf((o: AnonCredsRequestedAttribute) => o.names === undefined)
  public name?: string

  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o: AnonCredsRequestedAttribute) => o.name === undefined)
  @ArrayNotEmpty()
  public names?: string[]

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @IsInstance(AnonCredsRevocationInterval)
  @Type(() => AnonCredsRevocationInterval)
  @IsOptional()
  public nonRevoked?: AnonCredsRevocationInterval

  @ValidateNested({ each: true })
  @Type(() => AnonCredsRestriction)
  @IsOptional()
  @AnonCredsRestrictionTransformer()
  public restrictions?: AnonCredsRestriction[]
}
