import { KnownJwaKeyAgreementAlgorithms, type KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicEc } from './ecJwk'
import { ecPublicJwkToPublicKey, ecPublicKeyToPublicJwk } from './ecPublicKey'

type Jwk = KmsJwkPublicEc & { crv: 'P-521' }

export class P521PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [KnownJwaSignatureAlgorithms.ES512]
  public static supportdEncryptionKeyAgreementAlgorithms = [KnownJwaKeyAgreementAlgorithms.ECDH_ES]
  public static multicodecPrefix = 4610

  public supportdEncryptionKeyAgreementAlgorithms = P521PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = P521PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = P521PublicJwk.multicodecPrefix

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
    const jwk = ecPublicKeyToPublicJwk(publicKey, 'P-521')
    return new P521PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    const jwk = ecPublicKeyToPublicJwk(multicodec, 'P-521')
    return new P521PublicJwk(jwk)
  }
}
