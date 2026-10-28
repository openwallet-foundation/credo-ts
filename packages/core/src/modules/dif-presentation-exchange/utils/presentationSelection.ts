import { resolveDescriptorCredential } from 'presentation-exchange'
import { CredoError } from '../../../error'
import type { SingleOrArray } from '../../../types'
import { MdocDeviceResponse } from '../../mdoc'
import type { SdJwtVc } from '../../sd-jwt-vc'
import type { W3cJsonLdVerifiableCredential, W3cJwtVerifiableCredential } from '../../vc'
import {
  ClaimFormat,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
  W3cV2JwtVerifiablePresentation,
} from '../../vc'
import { W3cV2DataIntegrityVerifiablePresentation } from '../../vc/data-integrity'
import { W3cV2SdJwtVerifiablePresentation } from '../../vc/sd-jwt-vc'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  VerifiablePresentation,
} from '../models'
import { getPexPresentations } from './pexCredentials'

export type DifPexPresentationWithDescriptor = ReturnType<
  typeof extractPresentationsWithDescriptorsFromSubmission
>[number]
export function extractPresentationsWithDescriptorsFromSubmission(
  presentations: SingleOrArray<VerifiablePresentation>,
  submission: DifPresentationExchangeSubmission,
  definition: DifPresentationExchangeDefinition
) {
  const presentationsArray = Array.isArray(presentations) ? presentations : [presentations]
  const pexPresentations = getPexPresentations(presentationsArray)

  return submission.descriptor_map.map((descriptor) => {
    // The credential the presentation exchange library evaluates for this entry when verifying the submission
    const resolved = resolveDescriptorCredential(descriptor, pexPresentations)
    if (!resolved.success) {
      throw new CredoError(
        `Unable to extract the credential of submission descriptor '${descriptor.id}' at path '${descriptor.path}': ${resolved.message}`
      )
    }

    const { presentation_index: presentationIndex, credential_index: credentialIndex } = resolved.location
    const presentation = presentationsArray[presentationIndex] as VerifiablePresentation
    const inputDescriptor = definition.input_descriptors.find(({ id }) => id === descriptor.id)

    if (!inputDescriptor) {
      throw new Error(
        `Unable to extract input descriptor '${descriptor.id}' from definition '${definition.id}' for submission '${submission.id}'`
      )
    }

    if (presentation instanceof MdocDeviceResponse) {
      const document = presentation.deviceResponse.documents?.[credentialIndex]
      if (!document) {
        throw new CredoError(
          `Unable to extract mdoc document ${credentialIndex} from mdoc device response for submission '${submission.id}'.`
        )
      }

      return {
        claimFormat: ClaimFormat.MsoMdoc,
        descriptor,
        presentation,
        credential: document,
        inputDescriptor,
      } as const
    }
    if (
      presentation instanceof W3cJwtVerifiablePresentation ||
      presentation instanceof W3cJsonLdVerifiablePresentation
    ) {
      const credentials = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential
        : [presentation.verifiableCredential]
      const verifiableCredential: W3cJwtVerifiableCredential | W3cJsonLdVerifiableCredential | undefined =
        credentials[credentialIndex]

      if (!verifiableCredential) {
        throw new CredoError(
          `Unable to extract credential ${credentialIndex} from presentation ${presentationIndex} for submission descriptor '${descriptor.id}'`
        )
      }

      return {
        claimFormat: presentation.claimFormat,
        descriptor,
        presentation,
        credential: verifiableCredential,
        inputDescriptor,
      } as const
    }
    if (
      presentation instanceof W3cV2JwtVerifiablePresentation ||
      presentation instanceof W3cV2SdJwtVerifiablePresentation ||
      presentation instanceof W3cV2DataIntegrityVerifiablePresentation
    ) {
      throw new CredoError(
        `Presentation format '${presentation.claimFormat}' is not supported with DIF Presentation Exchange`
      )
    }
    return {
      claimFormat: ClaimFormat.SdJwtDc,
      descriptor,
      presentation,
      credential: presentation as SdJwtVc,
      inputDescriptor,
    } as const
  })
}
