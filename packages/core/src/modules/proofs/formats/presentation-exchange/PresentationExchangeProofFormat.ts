import type { InputDescriptorToCredentials, PresentationDefinition } from '../../../presentation-exchange'
import type {
  PresentationExchangePresentation,
  PresentationExchangeProposal,
  PresentationExchangeRequest,
} from '../../models/v2'
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
      options?: {
        challenge?: string
        domain?: string
      }
    }

    acceptRequest: {
      credentials?: InputDescriptorToCredentials
    }

    getCredentialsForRequest: {
      input: never
      output: {
        credentials: InputDescriptorToCredentials
      }
    }

    selectCredentialsForRequest: {
      input: never
      output: {
        credentials: InputDescriptorToCredentials
      }
    }
  }

  formatData: {
    proposal: PresentationExchangeProposal
    request: PresentationExchangeRequest
    presentation: PresentationExchangePresentation
  }
}
