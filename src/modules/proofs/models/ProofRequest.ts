import type { IndyProofRequest } from 'indy-sdk'
import { IsString, ValidateNested, IsOptional, IsIn } from 'class-validator'
import { Expose, Type } from 'class-transformer'

import { RevocationInterval } from '../../credentials'
import { ProofAttributeInfo } from './ProofAttributeInfo'
import { ProofPredicateInfo } from './ProofPredicateInfo'

import { JsonTransformer } from '../../../utils/JsonTransformer'
import { Optional } from '../../../utils/type'
import { RecordTransformer } from '../../../utils/transformers'

/**
 * Proof Request for Indy based proof format
 *
 * @see https://github.com/hyperledger/indy-sdk/blob/57dcdae74164d1c7aa06f2cccecaae121cefac25/libindy/src/api/anoncreds.rs#L1222-L1239
 */
export class ProofRequest {
  public constructor(options: Optional<Omit<ProofRequest, 'toJSON'>, 'requestedAttributes' | 'requestedPredicates'>) {
    if (options) {
      this.name = options.name
      this.version = options.version
      this.nonce = options.nonce
      this.requestedAttributes = options.requestedAttributes ?? {}
      this.requestedPredicates = options.requestedPredicates ?? {}
      this.nonRevoked = options.nonRevoked
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
  @ValidateNested({ each: true })
  @RecordTransformer(ProofAttributeInfo)
  public requestedAttributes!: Record<string, ProofAttributeInfo>

  @Expose({ name: 'requested_predicates' })
  @ValidateNested({ each: true })
  @RecordTransformer(ProofPredicateInfo)
  public requestedPredicates!: Record<string, ProofPredicateInfo>

  @Expose({ name: 'non_revoked' })
  @ValidateNested()
  @Type(() => RevocationInterval)
  @IsOptional()
  public nonRevoked?: RevocationInterval

  @IsIn(['1.0', '2.0'])
  @IsOptional()
  public ver?: '1.0' | '2.0'

  public toJSON() {
    // IndyProofRequest is indy-sdk json type
    return (JsonTransformer.toJSON(this) as unknown) as IndyProofRequest
  }
}
