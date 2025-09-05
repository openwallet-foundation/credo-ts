import type { DcqlMdocCredential, DcqlSdJwtVcCredential, DcqlW3cVcCredential } from 'dcql'
import { JsonObject } from '../../../types'
import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRecord } from '../../vc'
import type { DcqlCredentialsForRequest } from '../models'
import { canUseInstanceFromCredentialRecord, CredentialUseMode } from '../../../utils/credentialUse'
import { DcqlError } from '../DcqlError'

//  - the credentials included in the presentation
export interface DcqlSdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtVc
  credentialRecord: SdJwtVcRecord
  disclosedPayload: DcqlSdJwtVcCredential.Claims

  /**
   * Additional payload to include in the Key Binding JWT
   */
  additionalPayload?: JsonObject
  useMode: CredentialUseMode
}

export interface DcqlJwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
  useMode: CredentialUseMode
}

export interface DcqlLdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
  useMode: CredentialUseMode
}

export interface DcqlMdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  credentialRecord: MdocRecord
  disclosedPayload: DcqlMdocCredential.NameSpaces
  useMode: CredentialUseMode
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
      const matchIndex = matches.indexOf(match)
      let presentationToCreate: DcqlPresentationToCreate

      const useMode = match.useMode ?? CredentialUseMode.NewOrFirst
      if (!canUseInstanceFromCredentialRecord({ credentialRecord: match.credentialRecord, useMode })) {
        throw new DcqlError(
          `Unable to prepare presentation for credential at index ${matchIndex} for query credential '${credentialQueryId}'. No new credential instance available on the credential record.`
        )
      }

      if (match.claimFormat === ClaimFormat.SdJwtVc) {
        presentationToCreate = {
          claimFormat: ClaimFormat.SdJwtVc,
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
          additionalPayload: match.additionalPayload,
          useMode,
        }
      } else if (match.claimFormat === ClaimFormat.MsoMdoc) {
        presentationToCreate = {
          claimFormat: ClaimFormat.MsoMdoc,
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlMdocCredential.NameSpaces,
          useMode,
        }
      } else {
        presentationToCreate = {
          claimFormat: match.claimFormat === ClaimFormat.LdpVc ? ClaimFormat.LdpVp : ClaimFormat.JwtVp,
          credentialRecord: match.credentialRecord,
          disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
          useMode,
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
