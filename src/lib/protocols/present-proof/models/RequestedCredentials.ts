import { IsString, ValidateNested } from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { RequestedAttribute } from './RequestedAttribute';
import { RequestedPredicate } from './RequestedPredicate';
import { JsonTransformer } from '../../../utils/JsonTransformer';

interface RequestedCredentialsOptions {
  requestedAttributes?: Map<string, RequestedAttribute>;
  requestedPredicates?: Map<string, RequestedPredicate>;
  selfAttestedAttributes?: Map<string, string>;
}

/**
 * Requested Credentials for Indy proof creation
 *
 * @see https://github.com/hyperledger/indy-sdk/blob/57dcdae74164d1c7aa06f2cccecaae121cefac25/libindy/src/api/anoncreds.rs#L1433-L1445
 */
export class RequestedCredentials {
  public constructor(options: RequestedCredentialsOptions) {
    if (options) {
      this.requestedAttributes = options.requestedAttributes ?? new Map();
      this.requestedPredicates = options.requestedPredicates ?? new Map();
      this.selfAttestedAttributes = options.selfAttestedAttributes ?? new Map();
    }
  }

  @Expose({ name: 'requested_attributes' })
  @ValidateNested({ each: true })
  @Type(() => RequestedAttribute)
  public requestedAttributes!: Map<string, RequestedAttribute>;

  @Expose({ name: 'requested_predicates' })
  @ValidateNested({ each: true })
  @Type(() => RequestedPredicate)
  public requestedPredicates!: Map<string, RequestedPredicate>;

  @Expose({ name: 'self_attested_attributes' })
  @IsString({ each: true })
  public selfAttestedAttributes!: Map<string, string>;

  public toJSON() {
    // IndyRequestedCredentials is indy-sdk json type
    return (JsonTransformer.toJSON(this) as unknown) as IndyRequestedCredentials;
  }

  public getCredentialIdentifiers(): string[] {
    const credIds = new Set<string>();

    this.requestedAttributes.forEach(attr => {
      credIds.add(attr.credentialId);
    });

    this.requestedPredicates.forEach(pred => {
      credIds.add(pred.credentialId);
    });

    return Array.from(credIds);
  }
}
