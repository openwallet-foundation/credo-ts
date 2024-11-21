import type { JsonObject } from '../../../types'
import type { MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { W3cCredentialRecord } from '../../vc'
import type { MdocNameSpaces } from '@animo-id/mdoc'

/**
 * Mapping of credential query IDs to the selected credential record and the disclosed payload.
 */
export type DcqlCredentialsForRequest = Record<
  string,
  | {
      credentialRecord: MdocRecord
      disclosedPayload: MdocNameSpaces
    }
  | {
      credentialRecord: W3cCredentialRecord | SdJwtVcRecord
      disclosedPayload: JsonObject
    }
>
