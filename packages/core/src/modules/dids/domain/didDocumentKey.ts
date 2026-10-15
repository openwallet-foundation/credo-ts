import type { DidDocumentKey } from '../DidsApiOptions'
import { VerificationMethod } from './verificationMethod'

export function getKmsKeyIdForVerificationMethod(verificationMethod: VerificationMethod, keys?: DidDocumentKey[]) {
  return keys?.find(({ didDocumentRelativeKeyId }) => verificationMethod.id.endsWith(didDocumentRelativeKeyId))
    ?.kmsKeyId
}
