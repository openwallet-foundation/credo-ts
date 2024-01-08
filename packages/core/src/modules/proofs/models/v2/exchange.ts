import type { PexPresentationSubmission, PresentationDefinition } from '../../../presentation-exchange'
import type { W3cJsonPresentation } from '../../../vc/models/presentation/W3cJsonPresentation'

export type PresentationExchangeProposal = PresentationDefinition

export type PresentationExchangeRequest = {
  options?: {
    challenge?: string
    domain?: string
  }
  presentation_definition: PresentationDefinition
}

export type PresentationExchangePresentation =
  | (W3cJsonPresentation & {
      presentation_submission: PexPresentationSubmission
    })
  // NOTE: this is not spec compliant, as it doesn't describe how to submit
  // JWT VPs but to support JWT VPs we also allow the value to be a string
  | string
