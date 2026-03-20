import type { Uint8ArrayBuffer } from '../../../../types'
import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../jwa'
import type { KmsJwkPublicAsymmetric } from '../knownJwk'

export interface PublicJwkType<Jwk extends KmsJwkPublicAsymmetric = KmsJwkPublicAsymmetric> {
  readonly jwk: Jwk

  supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] | undefined
  supportedEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] | undefined

  multicodec: Uint8ArrayBuffer
}
