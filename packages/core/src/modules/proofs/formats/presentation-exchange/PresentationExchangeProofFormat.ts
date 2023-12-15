import type { W3cCredentialRecord, W3cVerifiableCredential } from '../../../vc'
import type { ProofFormat } from '../ProofFormat'
import type { PresentationDefinition } from '@aries-framework/presentation-exchange'

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

    createRequest: { presentationDefinition: PresentationDefinition }

    acceptRequest: {
      credentials: Record<string, Array<W3cVerifiableCredential>>
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
