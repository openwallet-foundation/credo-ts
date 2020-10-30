import { Expose } from "class-transformer/decorators";

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

    @Expose({ name: 'name' })
    public name!: string;
    @Expose({ name: 'version' })
    public version!: string;
    @Expose({ name: 'nonce' })
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
}

// IN PROGRESS
export class RequestedAttributes {

}

// IN PROGRESS
export class RequestedPredicates {

}