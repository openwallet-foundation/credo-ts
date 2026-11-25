import type { DidDocumentKey } from '../DidsApiOptions'
import { VerificationMethod } from './verificationMethod'

export function getDidDocumentKeyForVerificationMethod(
  verificationMethod: VerificationMethod,
  keys?: DidDocumentKey[]
) {
  return keys?.find(({ didDocumentRelativeKeyId }) => verificationMethod.id.endsWith(didDocumentRelativeKeyId))
}

export function getKmsKeyIdForVerifiacationMethod(verificationMethod: VerificationMethod, keys?: DidDocumentKey[]) {
  return getDidDocumentKeyForVerificationMethod(verificationMethod, keys)?.kmsKeyId
}
