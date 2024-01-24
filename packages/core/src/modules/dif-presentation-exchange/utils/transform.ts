import type { SdJwtVcRecord, SdJwtVc } from '../../sd-jwt-vc'
import type { W3cVerifiablePresentation } from '../../vc'
import type {
  OriginalVerifiableCredential as SphereonOriginalVerifiableCredential,
  OriginalVerifiablePresentation as SphereonOriginalVerifiablePresentation,
} from '@sphereon/ssi-types'

import { W3cCredentialRecord, W3cJsonLdVerifiablePresentation, W3cJwtVerifiablePresentation } from '../../vc'

export function getSphereonOriginalVerifiableCredential(
  credentialRecord: W3cCredentialRecord | SdJwtVcRecord
): SphereonOriginalVerifiableCredential {
  if (credentialRecord instanceof W3cCredentialRecord) {
    return credentialRecord.credential.encoded as SphereonOriginalVerifiableCredential
  } else {
    return credentialRecord.compactSdJwtVc
  }
}

export function getSphereonOriginalVerifiablePresentation(
  verifiablePresentation: W3cVerifiablePresentation | SdJwtVc
): SphereonOriginalVerifiablePresentation {
  if (
    verifiablePresentation instanceof W3cJwtVerifiablePresentation ||
    verifiablePresentation instanceof W3cJsonLdVerifiablePresentation
  ) {
    return verifiablePresentation.encoded as SphereonOriginalVerifiablePresentation
  } else {
    return verifiablePresentation.compact
  }
}
