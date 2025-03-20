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

export type DcqlPresentationToCreate = Record<
  string,
  | DcqlSdJwtVcPresentationToCreate
  | DcqlJwtVpPresentationToCreate
  | DcqlLdpVpPresentationToCreate
  | DcqlMdocPresentationToCreate
>

export function dcqlGetPresentationsToCreate(
  credentialsForInputDescriptor: DcqlCredentialsForRequest
): DcqlPresentationToCreate {
  const presentationsToCreate: DcqlPresentationToCreate = {}

  for (const [credentialQueryId, match] of Object.entries(credentialsForInputDescriptor)) {
    if (match.claimFormat === ClaimFormat.SdJwtVc) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.SdJwtVc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
        additionalPayload: match.additionalPayload,
      }
    } else if (match.claimFormat === ClaimFormat.MsoMdoc) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.MsoMdoc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlMdocCredential.NameSpaces,
      }
    } else {
      presentationsToCreate[credentialQueryId] = {
        claimFormat:
          match.credentialRecord.credential.claimFormat === ClaimFormat.JwtVc ? ClaimFormat.JwtVp : ClaimFormat.LdpVp,
        subjectIds: [match.credentialRecord.credential.credentialSubjectIds[0]],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
      }
    }
  }

  return presentationsToCreate
}
