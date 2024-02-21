import type { JwkJson } from './Jwk'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import { TypedArrayEncoder, Buffer } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { compress, expand } from './ecCompression'
import { hasKty, hasCrv, hasX, hasY, hasValidUse } from './validate'

export class K256Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.ES256K]
  public static readonly keyType = KeyType.K256

  public readonly x: string
  public readonly y: string

  public constructor({ x, y }: { x: string; y: string }) {
    super()

    this.x = x
    this.y = y
  }

  public get kty() {
    return JwaKeyType.EC as const
  }

  public get crv() {
    return JwaCurve.Secp256k1 as const
  }

  /**
   * Returns the public key of the K-256 JWK.
   *
   * NOTE: this is the compressed variant. We still need to add support for the
   * uncompressed variant.
   */
  public get publicKey() {
    const publicKeyBuffer = Buffer.concat([TypedArrayEncoder.fromBase64(this.x), TypedArrayEncoder.fromBase64(this.y)])
    const compressedPublicKey = compress(publicKeyBuffer)

    return Buffer.from(compressedPublicKey)
  }

  public get keyType() {
    return K256Jwk.keyType
  }

  public get supportedEncryptionAlgorithms() {
    return K256Jwk.supportedEncryptionAlgorithms
  }

  public get supportedSignatureAlgorithms() {
    return K256Jwk.supportedSignatureAlgorithms
  }

  public toJson() {
    return {
      ...super.toJson(),
      crv: this.crv,
      x: this.x,
      y: this.y,
    } as K256JwkJson
  }

  public static fromJson(jwkJson: JwkJson) {
    if (!isValidK256JwkPublicKey(jwkJson)) {
      throw new Error("Invalid 'K-256' JWK.")
    }

    return new K256Jwk({
      x: jwkJson.x,
      y: jwkJson.y,
    })
  }

  public static fromPublicKey(publicKey: Buffer) {
    const expanded = expand(publicKey, JwaCurve.Secp256k1)
    const x = expanded.slice(0, expanded.length / 2)
    const y = expanded.slice(expanded.length / 2)

    return new K256Jwk({
      x: TypedArrayEncoder.toBase64URL(x),
      y: TypedArrayEncoder.toBase64URL(y),
    })
  }
}

export interface K256JwkJson extends JwkJson {
  kty: JwaKeyType.EC
  crv: JwaCurve.Secp256k1
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export function isValidK256JwkPublicKey(jwk: JwkJson): jwk is K256JwkJson {
  return (
    hasKty(jwk, JwaKeyType.EC) &&
    hasCrv(jwk, JwaCurve.Secp256k1) &&
    hasX(jwk) &&
    hasY(jwk) &&
    hasValidUse(jwk, {
      supportsEncrypting: true,
      supportsSigning: true,
    })
  )
}
