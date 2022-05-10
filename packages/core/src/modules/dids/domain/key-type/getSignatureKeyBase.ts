import type { Key } from '../Key'
import type { VerificationMethod } from '../verificationMethod'

import { DidDocumentBuilder } from '../DidDocumentBuilder'

export function getSignatureKeyBase({
  did,
  key,
  verificationMethod,
}: {
  did: string
  key: Key
  verificationMethod: VerificationMethod
}) {
  const keyId = `${did}#${key.fingerprint}`

  return new DidDocumentBuilder(did)
    .addVerificationMethod(verificationMethod)
    .addAuthentication(keyId)
    .addAssertionMethod(keyId)
    .addCapabilityDelegation(keyId)
    .addCapabilityInvocation(keyId)
}
