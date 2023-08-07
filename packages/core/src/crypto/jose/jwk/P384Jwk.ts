import type { JwkJson } from './Jwk'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import { TypedArrayEncoder, Buffer } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { compress, expand } from './ecCompression'
import { hasKty, hasCrv, hasX, hasY, hasValidUse } from './validate'

export class P384Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.ES384]
  public static readonly keyType = KeyType.P384

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
    return JwaCurve.P384 as const
  }

  public get keyType() {
    return P384Jwk.keyType
  }

  public get supportedEncryptionAlgorithms() {
    return P384Jwk.supportedEncryptionAlgorithms
  }

  public get supportedSignatureAlgorithms() {
    return P384Jwk.supportedSignatureAlgorithms
  }

  /**
   * Returns the public key of the P-384 JWK.
   *
   * NOTE: this is the compressed variant. We still need to add support for the
   * uncompressed variant.
   */
  public get publicKey() {
    const publicKeyBuffer = Buffer.concat([TypedArrayEncoder.fromBase64(this.x), TypedArrayEncoder.fromBase64(this.y)])
    const compressedPublicKey = compress(publicKeyBuffer)

    return Buffer.from(compressedPublicKey)
  }

  public toJson() {
    return {
      ...super.toJson(),
      crv: this.crv,
      x: this.x,
      y: this.y,
    } as P384JwkJson
  }

  public static fromJson(jwk: JwkJson) {
    if (!isValidP384JwkPublicKey(jwk)) {
      throw new Error("Invalid 'P-384' JWK.")
    }

    return new P384Jwk({
      x: jwk.x,
      y: jwk.y,
    })
  }

  public static fromPublicKey(publicKey: Buffer) {
    const expanded = expand(publicKey, JwaCurve.P384)
    const x = expanded.slice(0, expanded.length / 2)
    const y = expanded.slice(expanded.length / 2)

    return new P384Jwk({
      x: TypedArrayEncoder.toBase64URL(x),
      y: TypedArrayEncoder.toBase64URL(y),
    })
  }
}

export interface P384JwkJson extends JwkJson {
  kty: JwaKeyType.EC
  crv: JwaCurve.P384
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export function isValidP384JwkPublicKey(jwk: JwkJson): jwk is P384JwkJson {
  return (
    hasKty(jwk, JwaKeyType.EC) &&
    hasCrv(jwk, JwaCurve.P384) &&
    hasX(jwk) &&
    hasY(jwk) &&
    hasValidUse(jwk, {
      supportsEncrypting: true,
      supportsSigning: true,
    })
  )
}
