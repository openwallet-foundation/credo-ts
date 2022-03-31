import { BufferEncoder } from '../../../../utils'
import { getFullVerkey } from '../../../../utils/did'
import { DidDocumentBuilder } from '../../domain'
import { convertPublicKeyToX25519 } from '../../domain/key-type/ed25519'

export function sovDidDocumentFromDid(fullDid: string, verkey: string) {
  const verificationMethodId = `${fullDid}#key-1`
  const keyAgreementId = `${fullDid}#key-agreement-1`

  const publicKeyBase58 = getFullVerkey(fullDid, verkey)
  const publicKeyX25519 = BufferEncoder.toBase58(convertPublicKeyToX25519(BufferEncoder.fromBase58(publicKeyBase58)))

  const builder = new DidDocumentBuilder(fullDid)
    .addContext('https://w3id.org/security/suites/ed25519-2018/v1')
    .addContext('https://w3id.org/security/suites/x25519-2019/v1')
    .addVerificationMethod({
      controller: fullDid,
      id: verificationMethodId,
      publicKeyBase58: publicKeyBase58,
      type: 'Ed25519VerificationKey2018',
    })
    .addVerificationMethod({
      controller: fullDid,
      id: keyAgreementId,
      publicKeyBase58: publicKeyX25519,
      type: 'X25519KeyAgreementKey2019',
    })
    .addAuthentication(verificationMethodId)
    .addAssertionMethod(verificationMethodId)
    .addKeyAgreement(keyAgreementId)

  return builder
}
