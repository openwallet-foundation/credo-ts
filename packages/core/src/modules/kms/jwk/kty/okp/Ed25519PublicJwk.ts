import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../../jwa'
import { PublicJwkType } from '../PublicJwk'
import { X25519PublicJwk } from './X25519PublicJwk'
import { KmsJwkPublicOkp } from './okpJwk'
import { okpPublicJwkToPublicKey, okpPublicKeyToPublicJwk } from './okpPublicKey'

type Jwk = KmsJwkPublicOkp & { crv: 'Ed25519' }

export class Ed25519PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [KnownJwaSignatureAlgorithms.EdDSA]
  public static supportdEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
  public static multicodecPrefix = 237

  public supportdEncryptionKeyAgreementAlgorithms = Ed25519PublicJwk.supportdEncryptionKeyAgreementAlgorithms
  public supportedSignatureAlgorithms = Ed25519PublicJwk.supportedSignatureAlgorithms
  public multicodecPrefix = Ed25519PublicJwk.multicodecPrefix

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey() {
    return {
      crv: this.jwk.crv,
      kty: this.jwk.kty,
      publicKey: okpPublicJwkToPublicKey(this.jwk),
    }
  }

  /**
   * Not supported for Ed25519
   */
  public get compressedPublicKey() {
    return null
  }

  public get multicodec() {
    return okpPublicJwkToPublicKey(this.jwk)
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    const jwk = okpPublicKeyToPublicJwk(publicKey, 'Ed25519')
    return new Ed25519PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: Uint8Array) {
    const jwk = okpPublicKeyToPublicJwk(multicodec, 'Ed25519')
    return new Ed25519PublicJwk(jwk)
  }

  public toX25519PublicJwk() {
    return X25519PublicJwk.fromPublicKey(convertPublicKeyToX25519(this.publicKey.publicKey)).jwk
  }
}
