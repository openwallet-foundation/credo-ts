import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../../../../../types'
import {
  type KnownJwaKeyAgreementAlgorithm,
  type KnownJwaSignatureAlgorithm,
  KnownJwaSignatureAlgorithms,
} from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicOkp } from './okpJwk'
import { okpPublicJwkToPublicKey, okpPublicKeyToPublicJwk } from './okpPublicKey'
import { X25519PublicJwk } from './X25519PublicJwk'

type Jwk = KmsJwkPublicOkp & { crv: 'Ed25519' }

export class Ed25519PublicJwk implements PublicJwkType<Jwk> {
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = [
    KnownJwaSignatureAlgorithms.EdDSA,
    KnownJwaSignatureAlgorithms.Ed25519,
  ]
  public static supportdEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
  public static multicodecPrefix = 237

  public supportedEncryptionKeyAgreementAlgorithms = Ed25519PublicJwk.supportdEncryptionKeyAgreementAlgorithms
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

  public static fromPublicKey(publicKey: AnyUint8Array) {
    const jwk = okpPublicKeyToPublicJwk(publicKey, 'Ed25519')
    return new Ed25519PublicJwk(jwk)
  }

  public static fromMulticodec(multicodec: AnyUint8Array) {
    const jwk = okpPublicKeyToPublicJwk(multicodec, 'Ed25519')
    return new Ed25519PublicJwk(jwk)
  }

  public toX25519PublicJwk() {
    return X25519PublicJwk.fromPublicKey(convertPublicKeyToX25519(this.publicKey.publicKey) as Uint8ArrayBuffer).jwk
  }
}
