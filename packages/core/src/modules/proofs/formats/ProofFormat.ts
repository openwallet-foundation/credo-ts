/**
 * Get the payload for a specific method from a list of ProofFormat interfaces and a method
 *
 * @example
 * ```
 *
 * type CreateRequestProofFormats = ProofFormatPayload<[IndyProofFormat, PresentationExchangeProofFormat], 'createRequest'>
 *
 * // equal to
 * type CreateRequestProofFormats = {
 *  indy: {
 *   // ... params for indy create request ...
 *  },
 *  presentationExchange: {
 *  // ... params for pex create request ...
 *  }
 * }
 * ```
 */
export type ProofFormatPayload<PFs extends ProofFormat[], M extends keyof ProofFormat['proofFormats']> = {
  [ProofFormat in PFs[number] as ProofFormat['formatKey']]?: ProofFormat['proofFormats'][M]
}

export interface ProofFormat {
  formatKey: string // e.g. 'ProofManifest', cannot be shared between different formats
  proofRecordType: string // e.g. 'w3c', can be shared between multiple formats
  proofFormats: {
    createProposal: unknown
    acceptProposal: unknown
    createRequest: unknown
    acceptRequest: unknown
    createPresentation: unknown
    acceptPresentation: unknown
    createProposalAsResponse: unknown
    createOutOfBandRequest: unknown
    createRequestAsResponse: unknown
    createProofRequestFromProposal: unknown
    requestCredentials: unknown
    retrieveCredentials: unknown
  }
  formatData: {
    proposal: unknown
    request: unknown
    presentation: unknown
  }
}
