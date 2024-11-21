import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { DcqlCredentialsForRequest } from '../models'
import type { DcqlSdJwtVcRepresentation, DcqlW3cVcRepresentation, DcqlMdocRepresentation } from 'dcql'

import { MdocRecord } from '../../mdoc'
import { W3cCredentialRecord, ClaimFormat } from '../../vc'

//  - the credentials included in the presentation
export interface DcqlSdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtVc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  credentialRecord: SdJwtVcRecord
  disclosedPayload: DcqlSdJwtVcRepresentation.Claims
}

export interface DcqlJwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  subjectIds: [string] // only one subject id supported for JWT VP
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcRepresentation.Claims
}

export interface DcqlLdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  // NOTE: we only support one subject id at the moment as we don't have proper
  // support yet for adding multiple proofs to an LDP-VP
  subjectIds: undefined | [string]
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcRepresentation.Claims
}

export interface DcqlMdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  subjectIds: []
  credentialRecord: MdocRecord
  disclosedPayload: DcqlMdocRepresentation.NameSpaces
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
    if (match.credentialRecord instanceof W3cCredentialRecord) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat:
          match.credentialRecord.credential.claimFormat === ClaimFormat.JwtVc ? ClaimFormat.JwtVp : ClaimFormat.LdpVp,
        subjectIds: [match.credentialRecord.credential.credentialSubjectIds[0]],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcRepresentation.Claims,
      }
    } else if (match.credentialRecord instanceof MdocRecord) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.MsoMdoc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlMdocRepresentation.NameSpaces,
      }
    } else {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.SdJwtVc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcRepresentation.Claims,
      }
    }
  }

  return presentationsToCreate
}
