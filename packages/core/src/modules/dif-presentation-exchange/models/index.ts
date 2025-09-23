export * from './DifPexCredentialsForRequest'
import type { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models'
import type { Mdoc, MdocDeviceResponse } from '../../mdoc'
import type { SdJwtVc } from '../../sd-jwt-vc'
import type { W3cV2VerifiableCredential, W3cVerifiableCredential, W3cVerifiablePresentation } from '../../vc'

import { PresentationSubmissionLocation } from '@animo-id/pex'
import { W3cV2VerifiablePresentation } from '../../vc/models/presentation/W3cV2VerifiablePresentation'

export { PresentationSubmissionLocation as DifPresentationExchangeSubmissionLocation }

// Re-export some types from sphereon library, but under more explicit names
export type DifPresentationExchangeDefinition = PresentationDefinitionV1 | PresentationDefinitionV2
export type DifPresentationExchangeDefinitionV1 = PresentationDefinitionV1
export type DifPresentationExchangeDefinitionV2 = PresentationDefinitionV2
export type DifPresentationExchangeSubmission = PresentationSubmission

// TODO: we might want to move this to another place at some point
export type VerifiablePresentation =
  | W3cV2VerifiablePresentation
  | W3cVerifiablePresentation
  | SdJwtVc
  | MdocDeviceResponse
export type VerifiableCredential = W3cV2VerifiableCredential | W3cVerifiableCredential | SdJwtVc | Mdoc
