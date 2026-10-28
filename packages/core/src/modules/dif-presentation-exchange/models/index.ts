export * from './DifPexInputDescriptorToCredentials'
export * from './DifPexQueryResult'

import type {
  InputDescriptorV1,
  InputDescriptorV2,
  PresentationDefinitionV1,
  PresentationDefinitionV2,
  PresentationSubmission,
} from 'presentation-exchange'
import type { Mdoc, MdocDeviceResponse } from '../../mdoc'
import type { SdJwtVc } from '../../sd-jwt-vc'
import type { W3cV2VerifiableCredential, W3cVerifiableCredential, W3cVerifiablePresentation } from '../../vc'
import type { W3cV2VerifiablePresentation } from '../../vc/models/presentation/W3cV2VerifiablePresentation'

/**
 * Where the presentation submission is placed. This decides how the `descriptor_map` paths are written.
 *
 * The values match the `PresentationSubmissionLocation` of `presentation-exchange`.
 */
export enum DifPresentationExchangeSubmissionLocation {
  /**
   * Next to the presentations, as in an OpenID4VP authorization response. Paths address the presentation
   * (`$`, or `$[n]` for several), and a credential inside a W3C presentation is addressed by `path_nested`.
   */
  External = 'external',
  /**
   * Inside the verifiable presentation, as in the DIDComm presentation exchange attachment. Paths address
   * the credential within the presentation, without `path_nested`.
   */
  Presentation = 'presentation',
}

// Re-export some types from the presentation exchange library, but under more explicit names
export type DifPresentationExchangeDefinition = PresentationDefinitionV1 | PresentationDefinitionV2
export type DifPresentationExchangeDefinitionV1 = PresentationDefinitionV1
export type DifPresentationExchangeDefinitionV2 = PresentationDefinitionV2
export type DifPresentationExchangeInputDescriptor = InputDescriptorV1 | InputDescriptorV2
export type DifPresentationExchangeSubmission = PresentationSubmission

// TODO: we might want to move this to another place at some point
export type VerifiablePresentation =
  | W3cV2VerifiablePresentation
  | W3cVerifiablePresentation
  | SdJwtVc
  | MdocDeviceResponse
export type VerifiableCredential = W3cV2VerifiableCredential | W3cVerifiableCredential | SdJwtVc | Mdoc
