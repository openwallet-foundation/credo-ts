export * from './DifPexCredentialsForRequest'
import type { Mdoc } from '../../mdoc'
import type { MdocVerifiablePresentation } from '../../mdoc/MdocVerifiablePresentation'
import type { SdJwtVc } from '../../sd-jwt-vc'
import type { W3cVerifiableCredential, W3cVerifiablePresentation } from '../../vc'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'

import { PresentationSubmissionLocation } from '@sphereon/pex'

// Re-export some types from sphereon library, but under more explicit names
export type DifPresentationExchangeDefinition = PresentationDefinitionV1 | PresentationDefinitionV2
export type DifPresentationExchangeDefinitionV1 = PresentationDefinitionV1
export type DifPresentationExchangeDefinitionV2 = PresentationDefinitionV2
export type DifPresentationExchangeSubmission = PresentationSubmission
export { PresentationSubmissionLocation as DifPresentationExchangeSubmissionLocation }

// TODO: we might want to move this to another place at some point
export type VerifiablePresentation = W3cVerifiablePresentation | SdJwtVc | MdocVerifiablePresentation
export type VerifiableCredential = W3cVerifiableCredential | SdJwtVc | Mdoc
