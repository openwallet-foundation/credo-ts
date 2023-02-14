import type { ProofAttributeInfoOptions } from './ProofAttributeInfo'
import type { ProofPredicateInfoOptions } from './ProofPredicateInfo'
import type { IndyProofRequest } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsIn, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { IsMap } from '../../../../../utils/transformers'
import { IndyRevocationInterval } from '../../../../credentials'

import { ProofAttributeInfo } from './ProofAttributeInfo'
import { ProofPredicateInfo } from './ProofPredicateInfo'

export interface ProofRequestOptions {
  name: string
  version: string
  nonce: string
  nonRevoked?: IndyRevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, ProofAttributeInfoOptions>
  requestedPredicates?: Record<string, ProofPredicateInfoOptions>
}

/**
 * Proof Request for Indy based proof format
 *
 * @see https://github.com/hyperledger/indy-sdk/blob/57dcdae74164d1c7aa06f2cccecaae121cefac25/libindy/src/api/anoncreds.rs#L1222-L1239
 */
export class ProofRequest {
  public constructor(options: ProofRequestOptions) {
    if (options) {
      this.name = options.name
      this.version = options.version
      this.nonce = options.nonce

      this.requestedAttributes = new Map(
        Object.entries(options.requestedAttributes ?? {}).map(([key, attribute]) => [
          key,
          new ProofAttributeInfo(attribute),
        ])
      )

      this.requestedPredicates = new Map(
        Object.entries(options.requestedPredicates ?? {}).map(([key, predicate]) => [
          key,
          new ProofPredicateInfo(predicate),
        ])
      )

      this.nonRevoked = options.nonRevoked ? new IndyRevocationInterval(options.nonRevoked) : undefined
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
  @Type(() => ProofAttributeInfo)
  @IsInstance(ProofAttributeInfo, { each: true })
  public requestedAttributes!: Map<string, ProofAttributeInfo>

  @Expose({ name: 'requested_predicates' })
  @IsMap()
  @ValidateNested({ each: true })
  @Type(() => ProofPredicateInfo)
  @IsInstance(ProofPredicateInfo, { each: true })
  public requestedPredicates!: Map<string, ProofPredicateInfo>

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @Type(() => IndyRevocationInterval)
  @IsOptional()
  @IsInstance(IndyRevocationInterval)
  public nonRevoked?: IndyRevocationInterval

  @IsIn(['1.0', '2.0'])
  @IsOptional()
  public ver?: '1.0' | '2.0'

  public toJSON() {
    // IndyProofRequest is indy-sdk json type
    return JsonTransformer.toJSON(this) as unknown as IndyProofRequest
  }
}
