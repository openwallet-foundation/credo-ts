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
  public requestedAttributes!: RequestedAttributes;
  public requestedPredicates!: RequestedPredicates;
}

interface ProofRequestInterface {
  name: string;
  version: string;
  nonce: string;
  requestedAttributes: RequestedAttributes;
  requestedPredicates: RequestedPredicates;
}

// IN PROGRESS
export class RequestedAttributes {
  public name!: string;

  public restrictions!: AttributeFilter[];
}

//This can be added in future as per requireent
export class AttributeFilter {
  public schemaId: string | undefined;
  public schemaName: string | undefined;
}

// IN PROGRESS
export class RequestedPredicates {}
