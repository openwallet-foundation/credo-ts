import type { DcqlMdocCredential, DcqlSdJwtVcCredential, DcqlW3cVcCredential } from 'dcql'
import type { JsonObject } from '../../../types'
import { CredentialMultiInstanceUseMode, canUseInstanceFromCredentialRecord } from '../../../utils/credentialUse'
import { MdocRecord } from '../../mdoc'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { ClaimFormat, W3cCredentialRecord, W3cV2CredentialRecord } from '../../vc'
import { DcqlError } from '../DcqlError'
import type { DcqlCredentialsForRequest } from '../models'

//  - the credentials included in the presentation
export interface DcqlSdJwtVcPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtDc
  credentialRecord: SdJwtVcRecord
  disclosedPayload: DcqlSdJwtVcCredential.Claims

  /**
   * Additional payload to include in the Key Binding JWT
   */
  additionalPayload?: JsonObject
  useMode: CredentialMultiInstanceUseMode
}

export interface DcqlJwtVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtVp
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
  useMode: CredentialMultiInstanceUseMode
}

export interface DcqlLdpVpPresentationToCreate {
  claimFormat: ClaimFormat.LdpVp
  credentialRecord: W3cCredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
  useMode: CredentialMultiInstanceUseMode
}

export interface DcqlMdocPresentationToCreate {
  claimFormat: ClaimFormat.MsoMdoc
  credentialRecord: MdocRecord
  disclosedPayload: DcqlMdocCredential.NameSpaces
  useMode: CredentialMultiInstanceUseMode
}

export interface DcqlJwtW3cVpPresentationToCreate {
  claimFormat: ClaimFormat.JwtW3cVp
  credentialRecord: W3cV2CredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
}

export interface DcqlSdJwtW3cVpPresentationToCreate {
  claimFormat: ClaimFormat.SdJwtW3cVp
  credentialRecord: W3cV2CredentialRecord
  disclosedPayload: DcqlW3cVcCredential.Claims
}

type DcqlPresentationToCreate =
  | DcqlSdJwtVcPresentationToCreate
  | DcqlJwtVpPresentationToCreate
  | DcqlLdpVpPresentationToCreate
  | DcqlMdocPresentationToCreate
  | DcqlJwtW3cVpPresentationToCreate
  | DcqlSdJwtW3cVpPresentationToCreate

export type DcqlPresentationsToCreate = Record<string, [DcqlPresentationToCreate, ...DcqlPresentationToCreate[]]>

export function dcqlGetPresentationsToCreate(
  credentialsForInputDescriptor: DcqlCredentialsForRequest
): DcqlPresentationsToCreate {
  const presentationsToCreate: DcqlPresentationsToCreate = {}

  for (const [credentialQueryId, matches] of Object.entries(credentialsForInputDescriptor)) {
    for (const match of matches) {
      const matchIndex = matches.indexOf(match)
      let presentationToCreate: DcqlPresentationToCreate

      const useMode = match.useMode ?? CredentialMultiInstanceUseMode.NewOrFirst
      if (!canUseInstanceFromCredentialRecord({ credentialRecord: match.credentialRecord, useMode })) {
        throw new DcqlError(
          `Unable to prepare presentation for credential at index ${matchIndex} for query credential '${credentialQueryId}'. No new credential instance available on the credential record.`
        )
      }

      switch (match.claimFormat) {
        case ClaimFormat.SdJwtDc:
          presentationToCreate = {
            claimFormat: ClaimFormat.SdJwtDc,
            credentialRecord: match.credentialRecord,
            disclosedPayload: match.disclosedPayload as DcqlSdJwtVcCredential.Claims,
            additionalPayload: match.additionalPayload,
            useMode,
          }
          break
        case ClaimFormat.MsoMdoc:
          presentationToCreate = {
            claimFormat: ClaimFormat.MsoMdoc,
            credentialRecord: match.credentialRecord,
            disclosedPayload: match.disclosedPayload as DcqlMdocCredential.NameSpaces,
            useMode,
          }
          break
        case ClaimFormat.JwtW3cVc:
        case ClaimFormat.SdJwtW3cVc:
          presentationToCreate = {
            claimFormat: match.claimFormat === ClaimFormat.JwtW3cVc ? ClaimFormat.JwtW3cVp : ClaimFormat.SdJwtW3cVp,
            credentialRecord: match.credentialRecord,
            disclosedPayload: match.disclosedPayload as DcqlW3cVcCredential.Claims,
          }
          break

        default:
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
