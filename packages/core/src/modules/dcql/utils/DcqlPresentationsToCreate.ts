import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { DcqlCredentialsForRequest } from '../models'
import type { DcqlSdJwtVcCredential, DcqlMdocCredential, DcqlW3cVcCredential } from 'dcql'

import { MdocRecord } from '../../mdoc'
import { W3cCredentialRecord, ClaimFormat } from '../../vc'
import { TransactionData } from '../../dif-presentation-exchange/index'
import { TransactionDataAuthorization } from '../../dif-presentation-exchange/models/TransactionData'
import { CredoError } from '../../../error/CredoError'

//  - the credentials included in the presentation
export interface DcqlSdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtVc
  subjectIds: [] // subject is included in the cnf of the sd-jwt and automatically extracted by PEX
  credentialRecord: SdJwtVcRecord
  disclosedPayload: DcqlSdJwtVcCredential.Claims
  transactionData?: TransactionData
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
  credentialsForInputDescriptor: DcqlCredentialsForRequest,
  transactionDataAuthorization?: TransactionDataAuthorization
): DcqlPresentationToCreate {
  const presentationsToCreate: DcqlPresentationToCreate = {}

  for (const [credentialQueryId, match] of Object.entries(credentialsForInputDescriptor)) {
    const transactionData = transactionDataAuthorization?.credentials.includes(credentialQueryId)
    if (transactionData && match.credentialRecord.type !== 'SdJwtVcRecord') {
      throw new CredoError('Transaction data is currently only supported for SD-JWT-VC')
    }

    if (match.credentialRecord instanceof W3cCredentialRecord) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat:
          match.credentialRecord.credential.claimFormat === ClaimFormat.JwtVc ? ClaimFormat.JwtVp : ClaimFormat.LdpVp,
        subjectIds: [match.credentialRecord.credential.credentialSubjectIds[0]],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
      }
    } else if (match.credentialRecord instanceof MdocRecord) {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.MsoMdoc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlMdocCredential.NameSpaces,
      }
    } else {
      presentationsToCreate[credentialQueryId] = {
        claimFormat: ClaimFormat.SdJwtVc,
        subjectIds: [],
        credentialRecord: match.credentialRecord,
        disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
        transactionData: transactionDataAuthorization?.transactionData,
      }
    }
  }

  return presentationsToCreate
}
