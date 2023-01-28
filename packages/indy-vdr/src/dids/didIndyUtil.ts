import { convertPublicKeyToX25519, DidDocumentBuilder, TypedArrayEncoder } from '@aries-framework/core'

import { getFullVerkey } from './didSovUtil'

// Create a base DIDDoc template according to https://hyperledger.github.io/indy-did-method/#base-diddoc-template
export function indyDidDocumentFromDid(did: string, verKeyBase58: string) {
  const verificationMethodId = `${did}#key-1`

  const publicKeyBase58 = verKeyBase58

  const builder = new DidDocumentBuilder(did)
    .addVerificationMethod({
      controller: did,
      id: verificationMethodId,
      publicKeyBase58,
      type: 'Ed25519VerificationKey2018',
    })
    .addAuthentication(verificationMethodId)

  return builder
}

export function createKeyAgreementKey(fullDid: string, verkey: string) {
  const publicKeyBase58 = getFullVerkey(fullDid, verkey)
  const publicKeyX25519 = TypedArrayEncoder.toBase58(
    convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(publicKeyBase58))
  )

  return publicKeyX25519
}
