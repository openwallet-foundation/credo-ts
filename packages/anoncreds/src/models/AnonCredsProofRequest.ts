import { Expose, Type } from 'class-transformer'
import { IsIn, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import { IsMap } from '../utils'
import type { AnonCredsRequestedAttributeOptions } from './AnonCredsRequestedAttribute'
import { AnonCredsRequestedAttribute } from './AnonCredsRequestedAttribute'
import type { AnonCredsRequestedPredicateOptions } from './AnonCredsRequestedPredicate'
import { AnonCredsRequestedPredicate } from './AnonCredsRequestedPredicate'
import { AnonCredsRevocationInterval } from './AnonCredsRevocationInterval'

export interface AnonCredsProofRequestOptions {
  name: string
  version: string
  nonce: string
  nonRevoked?: AnonCredsRevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, AnonCredsRequestedAttributeOptions>
  requestedPredicates?: Record<string, AnonCredsRequestedPredicateOptions>
}

/**
 * Proof Request for AnonCreds based proof format
 */
export class AnonCredsProofRequest {
  public constructor(options: AnonCredsProofRequestOptions) {
    if (options) {
      this.name = options.name
      this.version = options.version
      this.nonce = options.nonce

      this.requestedAttributes = new Map(
        Object.entries(options.requestedAttributes ?? {}).map(([key, attribute]) => [
          key,
          new AnonCredsRequestedAttribute(attribute),
        ])
      )

      this.requestedPredicates = new Map(
        Object.entries(options.requestedPredicates ?? {}).map(([key, predicate]) => [
          key,
          new AnonCredsRequestedPredicate(predicate),
        ])
      )

      this.nonRevoked = options.nonRevoked ? new AnonCredsRevocationInterval(options.nonRevoked) : undefined
      this.ver = options.ver
    }
  }

  @IsString()
  public name!: string

  @IsString()
  public version!: string

  @IsString()
  public nonce!: string

  @Expose({ name: 'requested_attributes' })
  @IsMap()
  @ValidateNested({ each: true })
  @Type(() => AnonCredsRequestedAttribute)
  public requestedAttributes!: Map<string, AnonCredsRequestedAttribute>

  @Expose({ name: 'requested_predicates' })
  @IsMap()
  @ValidateNested({ each: true })
  @Type(() => AnonCredsRequestedPredicate)
  public requestedPredicates!: Map<string, AnonCredsRequestedPredicate>

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @Type(() => AnonCredsRevocationInterval)
  @IsOptional()
  @IsInstance(AnonCredsRevocationInterval)
  public nonRevoked?: AnonCredsRevocationInterval

  @IsIn(['1.0', '2.0'])
  @IsOptional()
  public ver?: '1.0' | '2.0'
}
