export * from './DifPexCredentialsForRequest'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

import { PresentationSubmissionLocation } from '@sphereon/pex'

// Re-export some types from sphereon library, but under more explicit names
export type DifPresentationExchangeDefinition = PresentationDefinitionV1 | PresentationDefinitionV2
export type DifPresentationExchangeDefinitionV1 = PresentationDefinitionV1
export type DifPresentationExchangeDefinitionV2 = PresentationDefinitionV2
export type DifPresentationExchangeSubmission = PresentationSubmission
export { PresentationSubmissionLocation as DifPresentationExchangeSubmissionLocation }
