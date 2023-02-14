import type { RequestedAttributeOptions } from './RequestedAttribute'
import type { RequestedPredicateOptions } from './RequestedPredicate'
import type { IndyRequestedCredentials } from 'indy-sdk'

import { Expose } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { RecordTransformer } from '../../../../../utils/transformers'

import { RequestedAttribute } from './RequestedAttribute'
import { RequestedPredicate } from './RequestedPredicate'

export interface IndyRequestedCredentialsOptions {
  requestedAttributes?: Record<string, RequestedAttributeOptions>
  requestedPredicates?: Record<string, RequestedPredicateOptions>
  selfAttestedAttributes?: Record<string, string>
}

/**
 * Requested Credentials for Indy proof creation
 *
 * @see https://github.com/hyperledger/indy-sdk/blob/57dcdae74164d1c7aa06f2cccecaae121cefac25/libindy/src/api/anoncreds.rs#L1433-L1445
 */
export class RequestedCredentials {
  public constructor(options: IndyRequestedCredentialsOptions = {}) {
    if (options) {
      const { requestedAttributes, requestedPredicates } = options

      // Create RequestedAttribute objects from options
      this.requestedAttributes = {}
      if (requestedAttributes) {
        Object.keys(requestedAttributes).forEach((key) => {
          this.requestedAttributes[key] = new RequestedAttribute(requestedAttributes[key])
        })
      }

      // Create RequestedPredicate objects from options
      this.requestedPredicates = {}
      if (requestedPredicates) {
        Object.keys(requestedPredicates).forEach((key) => {
          this.requestedPredicates[key] = new RequestedPredicate(requestedPredicates[key])
        })
      }

      this.selfAttestedAttributes = options.selfAttestedAttributes ?? {}
    }
  }

  @Expose({ name: 'requested_attributes' })
  @ValidateNested({ each: true })
  @RecordTransformer(RequestedAttribute)
  public requestedAttributes!: Record<string, RequestedAttribute>

  @Expose({ name: 'requested_predicates' })
  @ValidateNested({ each: true })
  @RecordTransformer(RequestedPredicate)
  public requestedPredicates!: Record<string, RequestedPredicate>

  @Expose({ name: 'self_attested_attributes' })
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
