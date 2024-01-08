export * from './PexCredentialsForRequest'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

type PresentationDefinition = PresentationDefinitionV1 | PresentationDefinitionV2

// Re-export some types from sphereon library
export type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission, PresentationDefinition }
