import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../jwa'
import type { KmsJwkPublicAsymmetric } from '../knownJwk'

export interface PublicJwkType<Jwk extends KmsJwkPublicAsymmetric = KmsJwkPublicAsymmetric> {
  readonly jwk: Jwk

  supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] | undefined
  supportdEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] | undefined

  multicodec: Uint8Array
}
