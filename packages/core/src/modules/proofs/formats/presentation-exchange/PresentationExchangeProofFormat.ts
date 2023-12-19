import type { PresentationDefinition } from '../../../presentation-exchange'
import type { W3cCredentialRecord } from '../../../vc'
import type { ProofFormat } from '../ProofFormat'

export interface PresentationExchangeProofFormat extends ProofFormat {
  formatKey: 'presentationExchange'

  proofFormats: {
    createProposal: {
      presentationDefinition: PresentationDefinition
    }

    acceptProposal: {
      name?: string
      version?: string
    }

    createRequest: {
      presentationDefinition: PresentationDefinition
    }

    acceptRequest: {
      credentials: Array<W3cCredentialRecord>
    }

    getCredentialsForRequest: {
      input: never
      output: Array<W3cCredentialRecord>
    }

    selectCredentialsForRequest: {
      input: never
      output: Array<W3cCredentialRecord>
    }
  }

  formatData: {
    proposal: unknown
    request: unknown
    presentation: unknown
  }
}
