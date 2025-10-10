import { KnownJwaKeyAgreementAlgorithms, type KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicEc } from './ecJwk'
import { ecPublicJwkToPublicKey, ecPublicKeyToPublicJwk } from './ecPublicKey'

type Jwk = KmsJwkPublicEc & { crv: 'secp256k1' }

export class Secp256k1PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [KnownJwaSignatureAlgorithms.ES256K]
  public static supportdEncryptionKeyAgreementAlgorithms = [KnownJwaKeyAgreementAlgorithms.ECDH_ES]
  public static multicodecPrefix = 231

  public supportdEncryptionKeyAgreementAlgorithms = Secp256k1PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = Secp256k1PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = Secp256k1PublicJwk.multicodecPrefix

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey() {
    return {
      crv: this.jwk.crv,
      kty: this.jwk.kty,
      publicKey: ecPublicJwkToPublicKey(this.jwk),
    }
  }

  public get compressedPublicKey() {
    return {
      crv: this.jwk.crv,
      kty: this.jwk.kty,
      publicKey: ecPublicJwkToPublicKey(this.jwk, { compressed: true }),
    }
  }

  public get multicodec() {
    return ecPublicJwkToPublicKey(this.jwk, { compressed: true })
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    const jwk = ecPublicKeyToPublicJwk(publicKey, 'secp256k1')
    return new Secp256k1PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    const jwk = ecPublicKeyToPublicJwk(multicodec, 'secp256k1')
    return new Secp256k1PublicJwk(jwk)
  }
}
