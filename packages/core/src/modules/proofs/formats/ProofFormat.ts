export const INDY_ATTACH_ID = 'indy'
export const V2_INDY_PRESENTATION_PROPOSAL = 'hlindy/proof-req@v2.0'
export const V2_INDY_PRESENTATION_REQUEST = 'hlindy/proof-req@v2.0'
export const V2_INDY_PRESENTATION = 'hlindy/proof@v2.0'

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
 *  // ... params for presentation exchange create request ...
 *  }
 * }
 * ```
 */
export type ProofFormatPayload<PFs extends ProofFormat[], M extends keyof ProofFormat['proofFormats']> = {
  [ProofFormat in PFs[number] as ProofFormat['formatKey']]?: ProofFormat['proofFormats'][M]
}

export interface ProofFormat {
  formatKey: string // e.g. 'presentationExchange', cannot be shared between different formats
  proofFormats: {
    createProposal: unknown
    acceptProposal: unknown
    createRequest: unknown
    acceptRequest: unknown
  }
  formatData: {
    proposal: unknown
    request: unknown
    presentation: unknown
  }
}
