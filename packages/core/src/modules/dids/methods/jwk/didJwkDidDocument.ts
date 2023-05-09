import type { DidJwk } from './DidJwk'

import { AriesFrameworkError } from '../../../../error'
import { SECURITY_JWS_CONTEXT_URL } from '../../../vc/constants'
import { getJsonWebKey2020VerificationMethod, DidDocumentBuilder } from '../../domain'

export function getDidJwkDocument(didJwk: DidJwk) {
  if (!didJwk.allowsEncrypting && !didJwk.allowsSigning) {
    throw new AriesFrameworkError('At least one of allowsSigning or allowsEncrypting must be enabled')
  }

  const verificationMethod = getJsonWebKey2020VerificationMethod({
    did: didJwk.did,
    jwk: didJwk.jwk,
    verificationMethodId: `${didJwk.did}#0`,
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
