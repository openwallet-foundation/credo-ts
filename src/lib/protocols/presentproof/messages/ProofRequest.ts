import { Expose } from 'class-transformer/decorators';

export class ProofRequest {
  public constructor(proofRequest: ProofRequestInterface) {
    if (proofRequest) {
      this.name = proofRequest.name;
      this.version = proofRequest.version;
      this.nonce = proofRequest.nonce;
      this.requestedAttributes = proofRequest.requestedAttributes;
      this.requestedPredicates = proofRequest.requestedPredicates;
    }
  }

  public name!: string;

  public version!: string;

  public nonce!: string;
  @Expose({ name: 'requested_attributes' })
  public requestedAttributes!: RequestedAttributes;
  @Expose({ name: 'requested_predicates' })
  public requestedPredicates!: RequestedPredicates;
}

interface ProofRequestInterface {
  name: string;
  version: string;
  nonce: string;
  requestedAttributes: RequestedAttributes;
  requestedPredicates: RequestedPredicates;
  nonRevoked: RevocationInterval;
}

// IN PROGRESS
export class RequestedAttributes {
  public name!: string;

  public restrictions!: AttributeFilter[];

  @Expose({ name: 'non_revoked' })
  public nonRevoked!: RevocationInterval;
}

export class AttributeFilter {
  @Expose({ name: 'schema_id' })
  public schemaId: string | undefined;
  @Expose({ name: 'schema_name' })
  public schemaName: string | undefined;
  @Expose({ name: 'schema_issuer_did' })
  public schemaIssuerDid: string | undefined;
  @Expose({ name: 'schema_version' })
  public schemaVersion: string | undefined;
  @Expose({ name: 'issuer_did' })
  public issuerDid: string | undefined;
  @Expose({ name: 'cred_def_id' })
  public credDefId: string | undefined;
}

// IN PROGRESS
export class RequestedPredicates {
  @Expose({ name: 'p_type' })
  public predicateType!: string;
  @Expose({ name: 'p_value' })
  public predicateValue!: number;
}

export class RevocationInterval {
  public from!: number;
  public to!: number;
}
