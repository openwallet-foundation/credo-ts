import type { ProofFormat } from '../ProofFormat'

export interface PresentationExchangeProofFormat extends ProofFormat {
  formatKey: 'presentationExchange'

  proofFormats: {
    createProposal: unknown
    acceptProposal: {
      name?: string
      version?: string
    }
    createRequest: unknown
    acceptRequest: unknown

    getCredentialsForRequest: {
      input: unknown
      output: unknown
    }
    selectCredentialsForRequest: {
      input: unknown
      output: unknown
    }
  }

  formatData: {
    proposal: unknown
    request: unknown
    presentation: unknown
  }
}
