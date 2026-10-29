import type { JsonObject } from '../../../types'
import type { MdocNameSpaces, MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import type { ClaimFormat, W3cCredentialRecord } from '../../vc'

/**
 * A credential selected for an input descriptor, with what to disclose of it.
 */
export type SubmissionEntryCredential =
  | {
      claimFormat: ClaimFormat.SdJwtDc
      credentialRecord: SdJwtVcRecord

      /**
       * The payload that will be disclosed, including always disclosed attributes
       * and disclosures for the presentation definition
       */
      disclosedPayload: JsonObject

      /**
       * The paths to the claims that will be disclosed. When present, these are used for the
       * disclosure instead of `disclosedPayload`, which can't select individual array elements.
       */
      disclosedPaths?: ClaimPath[]

      /**
       * Additional payload that will be added to the Key Binding JWT. This can overwrite
       * existing parameters for KB-JWT so ensure you are only using this for non-default properties.
       */
      additionalPayload?: JsonObject
    }
  | {
      claimFormat: ClaimFormat.JwtVc | ClaimFormat.LdpVc
      credentialRecord: W3cCredentialRecord
    }
  | {
      claimFormat: ClaimFormat.MsoMdoc
      credentialRecord: MdocRecord
      disclosedPayload: MdocNameSpaces
    }

/**
 * Mapping of selected credentials for an input descriptor
 */
export type DifPexInputDescriptorToCredentials = Record<string, SubmissionEntryCredential[]>
