import type { IndyRequestedCredentials } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsObject, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../utils/JsonTransformer'
import { RecordTransformer } from '../../../utils/transformers'

import { RequestedAttribute } from './RequestedAttribute'
import { RequestedPredicate } from './RequestedPredicate'

interface RequestedCredentialsOptions {
  requestedAttributes?: Record<string, RequestedAttribute>
  requestedPredicates?: Record<string, RequestedPredicate>
  selfAttestedAttributes?: Record<string, string>
}

/**
 * Requested Credentials for Indy proof creation
 *
 * @see https://github.com/hyperledger/indy-sdk/blob/57dcdae74164d1c7aa06f2cccecaae121cefac25/libindy/src/api/anoncreds.rs#L1433-L1445
 */
export class RequestedCredentials {
  public constructor(options: RequestedCredentialsOptions = {}) {
    if (options) {
      this.requestedAttributes = options.requestedAttributes ?? {}
      this.requestedPredicates = options.requestedPredicates ?? {}
      this.selfAttestedAttributes = options.selfAttestedAttributes ?? {}
    }
  }

  @Expose({ name: 'requested_attributes' })
  @ValidateNested({ each: true })
  @Type(() => RequestedAttribute)
  @RecordTransformer(RequestedAttribute)
  public requestedAttributes!: Record<string, RequestedAttribute>

  @Expose({ name: 'requested_predicates' })
  @ValidateNested({ each: true })
  @Type(() => RequestedPredicate)
  @RecordTransformer(RequestedPredicate)
  public requestedPredicates!: Record<string, RequestedPredicate>

  @Expose({ name: 'self_attested_attributes' })
  @IsObject()
  public selfAttestedAttributes!: Record<string, string>

  public toJSON() {
    // IndyRequestedCredentials is indy-sdk json type
    return JsonTransformer.toJSON(this) as unknown as IndyRequestedCredentials
  }

  public getCredentialIdentifiers(): string[] {
    const credIds = new Set<string>()

    Object.values(this.requestedAttributes).forEach((attr) => {
      credIds.add(attr.credentialId)
    })

    Object.values(this.requestedPredicates).forEach((pred) => {
      credIds.add(pred.credentialId)
    })

    return Array.from(credIds)
  }
}
