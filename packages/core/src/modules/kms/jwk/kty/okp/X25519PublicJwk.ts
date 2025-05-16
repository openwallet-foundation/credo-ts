import { KnownJwaKeyAgreementAlgorithms, KnownJwaSignatureAlgorithm } from '../../jwa'
import { PublicJwkType } from '../PublicJwk'
import { KmsJwkPublicOkp } from './okpJwk'
import { okpPublicJwkToPublicKey, okpPublicKeyToPublicJwk } from './okpPublicKey'

type Jwk = KmsJwkPublicOkp & { crv: 'X25519' }

export class X25519PublicJwk implements PublicJwkType<Jwk> {
  public static supportdEncryptionKeyAgreementAlgorithms = [KnownJwaKeyAgreementAlgorithms.ECDH_HSALSA20]
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = []
  public static multicodecPrefix = 236

  public supportdEncryptionKeyAgreementAlgorithms = X25519PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = X25519PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = X25519PublicJwk.multicodecPrefix

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey() {
    return {
      crv: this.jwk.crv,
      kty: this.jwk.kty,
      publicKey: okpPublicJwkToPublicKey(this.jwk),
    }
  }

  public get multicodec() {
    return okpPublicJwkToPublicKey(this.jwk)
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    const jwk = okpPublicKeyToPublicJwk(publicKey, 'X25519')
    return new X25519PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    const jwk = okpPublicKeyToPublicJwk(multicodec, 'X25519')
    return new X25519PublicJwk(jwk)
  }
}
