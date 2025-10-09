import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { DifPexInputDescriptorToCredentials } from '../models'

import { MdocRecord } from '../../mdoc'
import { W3cCredentialRecord, ClaimFormat } from '../../vc'

//  - the credentials included in the presentation
export interface SdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtVc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  verifiableCredentials: [
    {
      credential: SdJwtVcRecord
      inputDescriptorId: string
    }
  ] // only one credential supported for SD-JWT-VC
}

export interface JwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  subjectIds: [string] // only one subject id supported for JWT VP
  verifiableCredentials: Array<{
    credential: W3cCredentialRecord
    inputDescriptorId: string
  }> // multiple credentials supported for JWT VP
}

export interface LdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  // NOTE: we only support one subject id at the moment as we don't have proper
  // support yet for adding multiple proofs to an LDP-VP
  subjectIds: undefined | [string]
  verifiableCredentials: Array<{
    credential: W3cCredentialRecord
    inputDescriptorId: string
  }> // multiple credentials supported for LDP VP
}

export interface MdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  subjectIds: []
  verifiableCredentials: [
    {
      credential: MdocRecord
      inputDescriptorId: string
    }
  ] // only one credential supported for MDOC
}

export type PresentationToCreate =
  | SdJwtVcPresentationToCreate
  | JwtVpPresentationToCreate
  | LdpVpPresentationToCreate
  | MdocPresentationToCreate

// FIXME: we should extract supported format form top-level presentation definition, and input_descriptor as well
// to make sure the presentation we are going to create is a presentation format supported by the verifier.
// In addition we should allow to pass an override 'format' object, as specification like OID4VP do not use the
// PD formats, but define their own.
export function getPresentationsToCreate(credentialsForInputDescriptor: DifPexInputDescriptorToCredentials) {
  const presentationsToCreate: Array<PresentationToCreate> = []

  // We map all credentials for a input descriptor to the different subject ids. Each subjectId will need
  // to create a separate proof (either on the same presentation or if not allowed by proof format on separate)
  // presentations
  for (const [inputDescriptorId, credentials] of Object.entries(credentialsForInputDescriptor)) {
    for (const credential of credentials) {
      if (credential instanceof W3cCredentialRecord) {
        const subjectId = credential.credential.credentialSubjectIds[0]

        // NOTE: we only support one subjectId per VP -- once we have proper support
        // for multiple proofs on an LDP-VP we can add multiple subjectIds to a single VP for LDP-vp only
        const expectedClaimFormat =
          credential.credential.claimFormat === ClaimFormat.LdpVc ? ClaimFormat.LdpVp : ClaimFormat.JwtVp

        const matchingClaimFormatAndSubject = presentationsToCreate.find(
          (p): p is JwtVpPresentationToCreate =>
            p.claimFormat === expectedClaimFormat && Boolean(p.subjectIds?.includes(subjectId))
        )

        if (matchingClaimFormatAndSubject) {
          matchingClaimFormatAndSubject.verifiableCredentials.push({ inputDescriptorId, credential })
        } else {
          presentationsToCreate.push({
            claimFormat: expectedClaimFormat,
            subjectIds: [subjectId],
            verifiableCredentials: [{ credential, inputDescriptorId }],
          })
        }
      } else if (credential instanceof MdocRecord) {
        presentationsToCreate.push({
          claimFormat: ClaimFormat.MsoMdoc,
          verifiableCredentials: [{ inputDescriptorId, credential }],
          subjectIds: [],
        })
      } else {
        // SD-JWT-VC always needs it's own presentation
        presentationsToCreate.push({
          claimFormat: ClaimFormat.SdJwtVc,
          subjectIds: [],
          verifiableCredentials: [{ inputDescriptorId, credential }],
        })
      }
    }
  }

  return presentationsToCreate
}
