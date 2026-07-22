import { CredoError } from '../../../error'
import type { JsonObject } from '../../../types'
import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRecord } from '../../vc'
import type { DifPexInputDescriptorToCredentials } from '../models'

//  - the credentials included in the presentation
export interface SdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtDc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  verifiableCredentials: [
    {
      credential: SdJwtVcRecord
      inputDescriptorId: string

      /**
       * Additional payload to include in the Key Binding JWT
       */
      additionalPayload?: JsonObject
    },
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
    },
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
      switch (credential.claimFormat) {
        case ClaimFormat.SdJwtDc: {
          if (!(credential.credentialRecord instanceof SdJwtVcRecord)) {
            throw new CredoError(
              `Claim format SdJwtDc requires SdJwtVcRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          // SD-JWT-VC always needs its own presentation
          presentationsToCreate.push({
            claimFormat: ClaimFormat.SdJwtDc,
            subjectIds: [],
            verifiableCredentials: [
              {
                inputDescriptorId,
                credential: credential.credentialRecord,
                additionalPayload: credential.additionalPayload,
              },
            ],
          })

          break
        }
        case ClaimFormat.MsoMdoc: {
          if (!(credential.credentialRecord instanceof MdocRecord)) {
            throw new CredoError(
              `Claim format MsoMdoc requires MdocRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          presentationsToCreate.push({
            claimFormat: ClaimFormat.MsoMdoc,
            verifiableCredentials: [{ inputDescriptorId, credential: credential.credentialRecord }],
            subjectIds: [],
          })

          break
        }
        case ClaimFormat.JwtVc:
        case ClaimFormat.LdpVc: {
          if (!(credential.credentialRecord instanceof W3cCredentialRecord)) {
            throw new CredoError(
              `Claim format JwtVc/LdpVc requires W3cCredentialRecord for input descriptor '${inputDescriptorId}'.`
            )
          }

          const subjectId = credential.credentialRecord.firstCredential.credentialSubjectIds[0]

          // NOTE: we only support one subjectId per VP -- once we have proper support
          // for multiple proofs on an LDP-VP we can add multiple subjectIds to a single VP for LDP-vp only
          const expectedClaimFormat =
            credential.credentialRecord.firstCredential.claimFormat === ClaimFormat.LdpVc
              ? ClaimFormat.LdpVp
              : ClaimFormat.JwtVp

          const matchingClaimFormatAndSubject = presentationsToCreate.find(
            (p): p is JwtVpPresentationToCreate | LdpVpPresentationToCreate =>
              p.claimFormat === expectedClaimFormat && Boolean(p.subjectIds?.includes(subjectId))
          )

          if (matchingClaimFormatAndSubject) {
            matchingClaimFormatAndSubject.verifiableCredentials.push({
              inputDescriptorId,
              credential: credential.credentialRecord,
            })
          } else {
            presentationsToCreate.push({
              claimFormat: expectedClaimFormat,
              subjectIds: [subjectId],
              verifiableCredentials: [{ credential: credential.credentialRecord, inputDescriptorId }],
            })
          }

          break
        }
        default: {
          const exhaustiveClaimFormat: never = credential
          void exhaustiveClaimFormat
          throw new CredoError(`Unsupported claim format for input descriptor '${inputDescriptorId}'.`)
        }
      }
    }
  }

  return presentationsToCreate
}
