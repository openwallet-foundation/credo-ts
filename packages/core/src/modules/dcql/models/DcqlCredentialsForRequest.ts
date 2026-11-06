import type { JsonObject, NonEmptyArray } from '../../../types'
import { CredentialMultiInstanceUseMode } from '../../../utils/credentialUse'
import type { MdocNameSpaces, MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import type { ClaimFormat, W3cCredentialRecord, W3cV2CredentialRecord } from '../../vc'

/**
 * What to disclose of a selectively disclosable credential (SD-JWT VC, W3C V2 SD-JWT VC).
 */
export type DcqlSelectiveDisclosure =
  | {
      /**
       * The paths to the claims to disclose, each with everything below it, as in `disclosed_paths` of a
       * DCQL claim set.
       */
      disclosedPaths: ClaimPath[]

      /**
       * Not used for the disclosure when `disclosedPaths` is given.
       */
      disclosedPayload?: JsonObject
    }
  | {
      disclosedPaths?: undefined

      /**
       * @deprecated Pass `disclosedPaths`, which will be required in the next breaking version. Disclosing
       * based on the payload selects an array as a whole, which does not disclose the elements that are
       * selectively disclosable on their own.
       */
      disclosedPayload: JsonObject
    }

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

        /**
         * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
         */
        useMode?: CredentialMultiInstanceUseMode
      }
    | ({
        claimFormat: ClaimFormat.SdJwtDc
        credentialRecord: SdJwtVcRecord

        /**
         * Additional payload that will be added to the Key Binding JWT. This can overwrite
         * existing parameters for KB-JWT so ensure you are only using this for non-default properties.
         */
        additionalPayload?: JsonObject

        /**
         * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
         */
        useMode?: CredentialMultiInstanceUseMode
      } & DcqlSelectiveDisclosure)
    | {
        claimFormat: ClaimFormat.JwtVc | ClaimFormat.LdpVc
        credentialRecord: W3cCredentialRecord
        disclosedPayload: JsonObject

        /**
         * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
         */
        useMode?: CredentialMultiInstanceUseMode
      }
    | {
        claimFormat: ClaimFormat.JwtW3cVc
        credentialRecord: W3cV2CredentialRecord
        disclosedPayload: JsonObject

        /**
         * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
         */
        useMode?: CredentialMultiInstanceUseMode
      }
    | ({
        claimFormat: ClaimFormat.SdJwtW3cVc
        credentialRecord: W3cV2CredentialRecord

        /**
         * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
         */
        useMode?: CredentialMultiInstanceUseMode
      } & DcqlSelectiveDisclosure)
  >
>
