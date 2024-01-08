import type {
  InputDescriptorToCredentials,
  PresentationDefinition,
  PexCredentialsForRequest,
} from '../../../presentation-exchange'
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
      options?: {
        challenge?: string
        domain?: string
      }
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
      // Presentation submission details which the options that are available
      output: PexCredentialsForRequest
    }

    selectCredentialsForRequest: {
      input: never
      // Input descriptor to credentials specifically details which credentials
      // should be used for which input descriptor
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
