import { Expose, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsInstance, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator'

import { IndyRevocationInterval } from '../../../../credentials'

import { AttributeFilter } from './AttributeFilter'

export type ProofAttributeInfoOptions = ProofAttributeInfo

export class ProofAttributeInfo {
  public constructor(options: ProofAttributeInfoOptions) {
    if (options) {
      this.name = options.name
      this.names = options.names
      this.nonRevoked = options.nonRevoked ? new IndyRevocationInterval(options.nonRevoked) : undefined
      this.restrictions = options.restrictions?.map((r) => new AttributeFilter(r))
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
