import { Expose, Type } from 'class-transformer'
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator'

import { AttributeFilter } from './AttributeFilter'
import { RevocationInterval } from '../../credentials'

export class ProofAttributeInfo {
  public constructor(options: ProofAttributeInfo) {
    if (options) {
      this.name = options.name
      this.names = options.names
      this.nonRevoked = options.nonRevoked
      this.restrictions = options.restrictions
    }
  }

  @IsString()
  @IsOptional()
  public name?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public names?: string[]

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
