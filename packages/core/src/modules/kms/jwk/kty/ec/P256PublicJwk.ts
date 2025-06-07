import { KnownJwaKeyAgreementAlgorithms, KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../../jwa'
import { PublicJwkType } from '../PublicJwk'
import { KmsJwkPublicEc } from './ecJwk'
import { ecPublicJwkToPublicKey, ecPublicKeyToPublicJwk } from './ecPublicKey'

type Jwk = KmsJwkPublicEc & { crv: 'P-256' }

export class P256PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [KnownJwaSignatureAlgorithms.ES256]
  public static supportdEncryptionKeyAgreementAlgorithms = [KnownJwaKeyAgreementAlgorithms.ECDH_ES]
  public static multicodecPrefix = 4608

  public supportdEncryptionKeyAgreementAlgorithms = P256PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = P256PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = P256PublicJwk.multicodecPrefix

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey() {
    return {
      crv: this.jwk.crv,
      kty: this.jwk.kty,
      publicKey: ecPublicJwkToPublicKey(this.jwk),
    }
  }

  public get multicodec() {
    return ecPublicJwkToPublicKey(this.jwk, { compressed: true })
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    const jwk = ecPublicKeyToPublicJwk(publicKey, 'P-256')
    return new P256PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    const jwk = ecPublicKeyToPublicJwk(multicodec, 'P-256')
    return new P256PublicJwk(jwk)
  }
}
