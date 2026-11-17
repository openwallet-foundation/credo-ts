import type { AgentContext } from '../../../agent'
import type { JsonObject } from '../../../types'
import {
  CredentialMultiInstanceUseMode,
  canUseInstanceFromCredentialRecord,
  useInstanceFromCredentialRecord,
} from '../../../utils/credentialUse'
import type { Mdoc, MdocRecord } from '../../mdoc'
import type { SdJwtVc, SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, type W3cCredentialRecord, type W3cVerifiableCredential } from '../../vc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import type { DifPexInputDescriptorToCredentials } from '../models'

//  - the credentials included in the presentation
export interface SdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtDc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  verifiableCredentials: [
    {
      credential: SdJwtVcRecord
      credentialInstance: SdJwtVc
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
    credentialInstance: W3cVerifiableCredential
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
    credentialInstance: W3cVerifiableCredential
    inputDescriptorId: string
  }> // multiple credentials supported for LDP VP
}

export interface MdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  subjectIds: []
  verifiableCredentials: [
    {
      credential: MdocRecord
      credentialInstance: Mdoc
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
//
// The use of each credential instance is stored here, before presenting, so a failed update can't lead to
// presenting an instance without counting it.
export async function getPresentationsToCreate(
  agentContext: AgentContext,
  credentialsForInputDescriptor: DifPexInputDescriptorToCredentials
) {
  const presentationsToCreate: Array<PresentationToCreate> = []

  // Checked for all credentials first, so no instance is counted when one can't be presented
  for (const [inputDescriptorId, credentials] of Object.entries(credentialsForInputDescriptor)) {
    for (const { credentialRecord, useMode = CredentialMultiInstanceUseMode.NewOrFirst } of credentials) {
      if (!canUseInstanceFromCredentialRecord({ credentialRecord, useMode })) {
        throw new DifPresentationExchangeError(
          `Unable to prepare presentation for credential record '${credentialRecord.id}' for input descriptor '${inputDescriptorId}'. No new credential instance available on the credential record.`
        )
      }
    }
  }

  // We map all credentials for a input descriptor to the different subject ids. Each subjectId will need
  // to create a separate proof (either on the same presentation or if not allowed by proof format on separate)
  // presentations
  for (const [inputDescriptorId, credentials] of Object.entries(credentialsForInputDescriptor)) {
    for (const credential of credentials) {
      const useMode = credential.useMode ?? CredentialMultiInstanceUseMode.NewOrFirst

      if (credential.claimFormat === ClaimFormat.SdJwtDc) {
        const { credentialInstance } = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: credential.credentialRecord,
          useMode,
        })

        // SD-JWT-VC always needs it's own presentation
        presentationsToCreate.push({
          claimFormat: ClaimFormat.SdJwtDc,
          subjectIds: [],
          verifiableCredentials: [
            {
              inputDescriptorId,
              credential: credential.credentialRecord,
              credentialInstance,
              additionalPayload: credential.additionalPayload,
            },
          ],
        })
      } else if (credential.claimFormat === ClaimFormat.MsoMdoc) {
        const { credentialInstance } = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: credential.credentialRecord,
          useMode,
        })

        presentationsToCreate.push({
          claimFormat: ClaimFormat.MsoMdoc,
          verifiableCredentials: [{ inputDescriptorId, credential: credential.credentialRecord, credentialInstance }],
          subjectIds: [],
        })
      } else {
        const { credentialInstance } = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: credential.credentialRecord,
          useMode,
        })
        // Instances of a batch can each have their own subject id
        const subjectId = credentialInstance.credentialSubjectIds[0]

        // NOTE: we only support one subjectId per VP -- once we have proper support
        // for multiple proofs on an LDP-VP we can add multiple subjectIds to a single VP for LDP-vp only
        const expectedClaimFormat =
          credentialInstance.claimFormat === ClaimFormat.LdpVc ? ClaimFormat.LdpVp : ClaimFormat.JwtVp

        const matchingClaimFormatAndSubject = presentationsToCreate.find(
          (p): p is JwtVpPresentationToCreate =>
            p.claimFormat === expectedClaimFormat && Boolean(p.subjectIds?.includes(subjectId))
        )

        if (matchingClaimFormatAndSubject) {
          matchingClaimFormatAndSubject.verifiableCredentials.push({
            inputDescriptorId,
            credential: credential.credentialRecord,
            credentialInstance,
          })
        } else {
          presentationsToCreate.push({
            claimFormat: expectedClaimFormat,
            subjectIds: [subjectId],
            verifiableCredentials: [{ credential: credential.credentialRecord, credentialInstance, inputDescriptorId }],
          })
        }
      }
    }
  }

  return presentationsToCreate
}
