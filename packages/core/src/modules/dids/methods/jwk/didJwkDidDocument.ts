import type { DidJwk } from './DidJwk'

import { CredoError } from '../../../../error'
import { SECURITY_JWS_CONTEXT_URL } from '../../../vc/constants'
import { DidDocumentBuilder, getJsonWebKey2020 } from '../../domain'

export function getDidJwkDocument(didJwk: DidJwk) {
  if (!didJwk.allowsEncrypting && !didJwk.allowsSigning) {
    throw new CredoError('At least one of allowsSigning or allowsEncrypting must be enabled')
  }

  const verificationMethod = getJsonWebKey2020({
    did: didJwk.did,
    publicJwk: didJwk.publicJwk,
    verificationMethodId: didJwk.verificationMethodId,
  })

  const didDocumentBuilder = new DidDocumentBuilder(didJwk.did)
    .addContext(SECURITY_JWS_CONTEXT_URL)
    .addVerificationMethod(verificationMethod)

  if (didJwk.allowsSigning) {
    didDocumentBuilder
      .addAuthentication(verificationMethod.id)
      .addAssertionMethod(verificationMethod.id)
      .addCapabilityDelegation(verificationMethod.id)
      .addCapabilityInvocation(verificationMethod.id)
  }

  if (didJwk.allowsEncrypting) {
    didDocumentBuilder.addKeyAgreement(verificationMethod.id)
  }

  return didDocumentBuilder.build()
}
