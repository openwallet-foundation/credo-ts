/**
 * Get the payload for a specific method from a list of ProofFormat interfaces and a method
 *
 * @example
 * ```
 *
 * type CreateRequestProofFormats = ProofFormatPayload<[IndyProofFormat, JsonLdProofFormat], 'createOffer'>
 *
 * // equal to
 * type CreateRequestProofFormats = {
 *  indy: {
 *   // ... params for indy create request ...
 *  },
 *  presentation-exchange: {
 *  // ... params for pex create request ...
 *  }
 * }
 * ```
 */
export type ProofFormatPayload<PFs extends ProofFormat[], M extends keyof ProofFormat['proofFormats']> = {
  [ProofFormat in PFs[number] as ProofFormat['formatKey']]?: ProofFormat['proofFormats'][M]
}

type ProofFormatType = {
  createProposal: unknown
  createRequest: unknown
  acceptRequest: unknown
  createPresentation: unknown
  acceptPresentation: unknown
  createProposalAsResponse: unknown
  createOutOfBandRequest: unknown
  createRequestAsResponse: unknown
  createProofRequestFromProposal: unknown
}

type FormatDataType = {
  proposal: unknown
  request: unknown
  presentation: unknown
}

export interface ProofFormat {
  formatKey: string // e.g. 'ProofManifest', cannot be shared between different formats
  proofRecordType: string // e.g. 'w3c', can be shared between multiple formats
  proofFormats: ProofFormatType
  formatData: FormatDataType
}
