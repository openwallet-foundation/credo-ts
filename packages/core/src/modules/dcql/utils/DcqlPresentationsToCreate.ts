import type { DcqlMdocCredential, DcqlSdJwtVcCredential, DcqlW3cVcCredential } from 'dcql'
import { JsonObject } from '../../../types'
import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRecord } from '../../vc'
import type { DcqlCredentialsForRequest } from '../models'

//  - the credentials included in the presentation
export interface DcqlSdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtVc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  credentialRecord: SdJwtVcRecord
  disclosedPayload: DcqlSdJwtVcCredential.Claims

  /**
   * Additional payload to include in the Key Binding JWT
   */
  additionalPayload?: JsonObject
}

export interface DcqlJwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  subjectIds: [string] // only one subject id supported for JWT VP
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
}

export interface DcqlLdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  // NOTE: we only support one subject id at the moment as we don't have proper
  // support yet for adding multiple proofs to an LDP-VP
  subjectIds: undefined | [string]
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
}

export interface DcqlMdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  subjectIds: []
  credentialRecord: MdocRecord
  disclosedPayload: DcqlMdocCredential.NameSpaces
}

type DcqlPresentationToCreate =
  | DcqlSdJwtVcPresentationToCreate
  | DcqlJwtVpPresentationToCreate
  | DcqlLdpVpPresentationToCreate
  | DcqlMdocPresentationToCreate

export type DcqlPresentationsToCreate = Record<string, [DcqlPresentationToCreate, ...DcqlPresentationToCreate[]]>

export function dcqlGetPresentationsToCreate(
  credentialsForInputDescriptor: DcqlCredentialsForRequest
): DcqlPresentationsToCreate {
  const presentationsToCreate: DcqlPresentationsToCreate = {}

  for (const [credentialQueryId, matches] of Object.entries(credentialsForInputDescriptor)) {
    for (const match of matches) {
      let presentationToCreate: DcqlPresentationToCreate

      if (match.claimFormat === ClaimFormat.SdJwtVc) {
        presentationToCreate = {
          claimFormat: ClaimFormat.SdJwtVc,
          subjectIds: [],
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
          additionalPayload: match.additionalPayload,
        }
      } else if (match.claimFormat === ClaimFormat.MsoMdoc) {
        presentationToCreate = {
          claimFormat: ClaimFormat.MsoMdoc,
          subjectIds: [],
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlMdocCredential.NameSpaces,
        }
      } else {
        presentationToCreate = {
          claimFormat: match.claimFormat === ClaimFormat.LdpVc ? ClaimFormat.LdpVp : ClaimFormat.JwtVp,
          subjectIds: [match.credentialRecord.credential.credentialSubjectIds[0]],
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
        }
      }

      if (!presentationsToCreate[credentialQueryId]) {
        presentationsToCreate[credentialQueryId] = [presentationToCreate]
      } else {
        presentationsToCreate[credentialQueryId].push(presentationToCreate)
      }
    }
  }

  return presentationsToCreate
}
