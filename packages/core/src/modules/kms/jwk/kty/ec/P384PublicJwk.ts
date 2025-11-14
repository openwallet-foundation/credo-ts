import type { AnyUint8Array } from '../../../../../types'
import { KnownJwaKeyAgreementAlgorithms, type KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicEc } from './ecJwk'
import { ecPublicJwkToPublicKey, ecPublicKeyToPublicJwk } from './ecPublicKey'

type Jwk = KmsJwkPublicEc & { crv: 'P-384' }

export class P384PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [KnownJwaSignatureAlgorithms.ES384]
  public static supportdEncryptionKeyAgreementAlgorithms = [KnownJwaKeyAgreementAlgorithms.ECDH_ES]
  public static multicodecPrefix = 4609

  public supportdEncryptionKeyAgreementAlgorithms = P384PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = P384PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = P384PublicJwk.multicodecPrefix

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

  public static fromPublicKey(publicKey: AnyUint8Array) {
    const jwk = ecPublicKeyToPublicJwk(publicKey, 'P-384')
    return new P384PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: AnyUint8Array) {
    const jwk = ecPublicKeyToPublicJwk(multicodec, 'P-384')
    return new P384PublicJwk(jwk)
  }
}
