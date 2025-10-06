import type { JsonObject, NonEmptyArray } from '../../../types'
import type { MdocNameSpaces, MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimFormat, W3cCredentialRecord, W3cV2CredentialRecord } from '../../vc'

/**
 * Mapping of credential query IDs to the selected credential record and the disclosed payload.
 */
export type DcqlCredentialsForRequest = Record<
  string,
  NonEmptyArray<
    | {
        claimFormat: ClaimFormat.MsoMdoc
        credentialRecord: MdocRecord
        disclosedPayload: MdocNameSpaces
      }
    | {
        claimFormat: ClaimFormat.SdJwtDc
        credentialRecord: SdJwtVcRecord
        disclosedPayload: JsonObject

        /**
         * Additional payload that will be added to the Key Binding JWT. This can overwrite
         * existing parameters for KB-JWT so ensure you are only using this for non-default properties.
         */
        additionalPayload?: JsonObject
      }
    | {
        claimFormat: ClaimFormat.JwtVc | ClaimFormat.LdpVc
        credentialRecord: W3cCredentialRecord
        disclosedPayload: JsonObject
      }
    | {
        claimFormat: ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc
        credentialRecord: W3cV2CredentialRecord
        disclosedPayload: JsonObject
      }
  >
>
