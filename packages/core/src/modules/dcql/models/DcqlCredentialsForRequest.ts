import type { JsonObject } from '../../../types'
import type { MdocNameSpaces, MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimFormat, W3cCredentialRecord } from '../../vc'

/**
 * Mapping of credential query IDs to the selected credential record and the disclosed payload.
 */
export type DcqlCredentialsForRequest = Record<
  string,
  | {
      claimFormat: ClaimFormat.MsoMdoc
      credentialRecord: MdocRecord
      disclosedPayload: MdocNameSpaces
    }
  | {
      claimFormat: ClaimFormat.SdJwtVc
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
>
