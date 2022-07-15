import { TypedArrayEncoder } from '../../../../utils'
import { getFullVerkey } from '../../../../utils/did'
import { SECURITY_X25519_CONTEXT_URL } from '../../../vc/constants'
import { ED25519_SUITE_CONTEXT_URL_2018 } from '../../../vc/signature-suites/ed25519/constants'
import { DidDocumentBuilder } from '../../domain'
import { convertPublicKeyToX25519 } from '../../domain/key-type/ed25519'

export function sovDidDocumentFromDid(fullDid: string, verkey: string) {
  const verificationMethodId = `${fullDid}#key-1`
  const keyAgreementId = `${fullDid}#key-agreement-1`

  const publicKeyBase58 = getFullVerkey(fullDid, verkey)
  const publicKeyX25519 = TypedArrayEncoder.toBase58(
    convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(publicKeyBase58))
  )

  const builder = new DidDocumentBuilder(fullDid)
    .addContext(ED25519_SUITE_CONTEXT_URL_2018)
    .addContext(SECURITY_X25519_CONTEXT_URL)
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
