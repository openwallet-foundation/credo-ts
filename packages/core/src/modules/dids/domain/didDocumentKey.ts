import type { DidDocumentKey } from '../DidsApiOptions'
import { VerificationMethod } from './verificationMethod'

export function getKmsKeyIdForVerifiacationMethod(verificationMethod: VerificationMethod, keys?: DidDocumentKey[]) {
  return keys?.find(({ didDocumentRelativeKeyId }) => verificationMethod.id.endsWith(didDocumentRelativeKeyId))
    ?.kmsKeyId
}
