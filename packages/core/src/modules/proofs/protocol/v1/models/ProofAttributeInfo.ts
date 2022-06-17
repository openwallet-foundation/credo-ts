import { Expose, Type } from 'class-transformer'
import { IsString, IsOptional, IsArray, ValidateNested, IsInstance, ValidateIf, ArrayNotEmpty } from 'class-validator'

import { IndyRevocationInterval } from '../../../../credentials'

import { AttributeFilter } from './AttributeFilter'

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
  @ValidateIf((o: ProofAttributeInfo) => o.names === undefined)
  public name?: string

  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o: ProofAttributeInfo) => o.name === undefined)
  @ArrayNotEmpty()
  public names?: string[]

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @IsInstance(IndyRevocationInterval)
  @Type(() => IndyRevocationInterval)
  @IsOptional()
  public nonRevoked?: IndyRevocationInterval

  @ValidateNested({ each: true })
  @Type(() => AttributeFilter)
  @IsOptional()
  @IsInstance(AttributeFilter, { each: true })
  public restrictions?: AttributeFilter[]
}
