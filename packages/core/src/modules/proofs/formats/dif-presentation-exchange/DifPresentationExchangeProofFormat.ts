import type {
  DifPexInputDescriptorToCredentials,
  DifPexCredentialsForRequest,
  DifPresentationExchangeDefinitionV1,
} from '../../../dif-presentation-exchange'
import type { W3cJsonPresentation } from '../../../vc/models/presentation/W3cJsonPresentation'
import type { ProofFormat } from '../ProofFormat'

export type DifPresentationExchangeProposal = DifPresentationExchangeDefinitionV1

export type DifPresentationExchangeRequest = {
  options?: {
    challenge?: string
    domain?: string
  }
  presentation_definition: DifPresentationExchangeDefinitionV1
}

export type DifPresentationExchangePresentation =
  | W3cJsonPresentation
  // NOTE: this is not spec compliant, as it doesn't describe how to submit
  // JWT VPs but to support JWT VPs we also allow the value to be a string
  | string

export interface DifPresentationExchangeProofFormat extends ProofFormat {
  formatKey: 'presentationExchange'

  proofFormats: {
    createProposal: {
      presentationDefinition: DifPresentationExchangeDefinitionV1
    }

    acceptProposal: {
      options?: {
        challenge?: string
        domain?: string
      }
    }

    createRequest: {
      presentationDefinition: DifPresentationExchangeDefinitionV1
      options?: {
        challenge?: string
        domain?: string
      }
    }

    acceptRequest: {
      credentials?: DifPexInputDescriptorToCredentials
    }

    getCredentialsForRequest: {
      input: never
      // Presentation submission details which the options that are available
      output: DifPexCredentialsForRequest
    }

    selectCredentialsForRequest: {
      input: never
      // Input descriptor to credentials specifically details which credentials
      // should be used for which input descriptor
      output: {
        credentials: DifPexInputDescriptorToCredentials
      }
    }
  }

  formatData: {
    proposal: DifPresentationExchangeProposal
    request: DifPresentationExchangeRequest
    presentation: DifPresentationExchangePresentation
  }
}
