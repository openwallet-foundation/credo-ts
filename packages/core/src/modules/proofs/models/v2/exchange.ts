import type { PexPresentationSubmission, PresentationDefinition } from '../../../presentation-exchange'
import type { W3cPresentation } from '../../../vc'

export type PresentationExchangeProposal = PresentationDefinition

export type PresentationExchangeRequest = {
  options: {
    challenge?: string
    domain?: string
  }
  presentation_definition: PresentationDefinition
}

export type PresentationExchangePresentation = W3cPresentation & {
  presentation_submission: PexPresentationSubmission
} & Record<string, unknown>
