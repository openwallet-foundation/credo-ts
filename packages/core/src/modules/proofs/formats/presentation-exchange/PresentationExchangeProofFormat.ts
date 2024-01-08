import type {
  InputDescriptorToCredentials,
  PexCredentialsForRequest,
  PresentationDefinitionV1,
  PresentationSubmission,
} from '../../../presentation-exchange'
import type { W3cJsonPresentation } from '../../../vc/models/presentation/W3cJsonPresentation'
import type { ProofFormat } from '../ProofFormat'

export type PresentationExchangeProposal = PresentationDefinitionV1

export type PresentationExchangeRequest = {
  options?: {
    challenge?: string
    domain?: string
  }
  presentation_definition: PresentationDefinitionV1
}

export type PresentationExchangePresentation =
  | (W3cJsonPresentation & {
      presentation_submission: PresentationSubmission
    })
  // NOTE: this is not spec compliant, as it doesn't describe how to submit
  // JWT VPs but to support JWT VPs we also allow the value to be a string
  | string

export interface PresentationExchangeProofFormat extends ProofFormat {
  formatKey: 'presentationExchange'

  proofFormats: {
    createProposal: {
      presentationDefinition: PresentationDefinitionV1
    }

    acceptProposal: {
      options?: {
        challenge?: string
        domain?: string
      }
    }

    createRequest: {
      presentationDefinition: PresentationDefinitionV1
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
