import type { JwkJson } from './Jwk'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import {
  compressECPoint,
  expand,
  isValidCompressedPublicKey,
  isValidUncompressedPublicKey,
  PREFIX_UNCOMPRESSED,
} from './ecCompression'
import { hasKty, hasCrv, hasX, hasY, hasValidUse } from './validate'
import { CredoError } from '../../../error'

export class P384Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.ES384]
  public static readonly keyType = KeyType.P384

  private readonly _x: Uint8Array
  private readonly _y: Uint8Array

  public constructor({ x, y }: { x: string | Uint8Array; y: string | Uint8Array }) {
    super()

    const xAsBytes = typeof x === 'string' ? TypedArrayEncoder.fromBase64(x) : x
    const yAsBytes = typeof y === 'string' ? TypedArrayEncoder.fromBase64(y) : y

    this._x = xAsBytes
    this._y = yAsBytes
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

  public get x() {
    return TypedArrayEncoder.toBase64URL(this._x)
  }

  public get y() {
    return TypedArrayEncoder.toBase64URL(this._y)
  }

  /**
   * Returns the uncompressed public key of the P-384 JWK.
   */
  public get publicKey() {
    return new Uint8Array([PREFIX_UNCOMPRESSED, ...this._x, ...this._y])
  }

  /**
   * Returns the compressed public key of the P-384 JWK.
   */
  public get publicKeyCompressed() {
    return compressECPoint(this._x, this._y)
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

  public static fromPublicKey(publicKey: Uint8Array) {
    if (isValidCompressedPublicKey(publicKey, this.keyType)) {
      const expanded = expand(publicKey, this.keyType)
      const x = expanded.slice(1, expanded.length / 2 + 1)
      const y = expanded.slice(expanded.length / 2 + 1)

      return new P384Jwk({ x, y })
    }

    if (isValidUncompressedPublicKey(publicKey, this.keyType)) {
      const x = publicKey.slice(1, publicKey.length / 2 + 1)
      const y = publicKey.slice(publicKey.length / 2 + 1)

      return new P384Jwk({ x, y })
    }

    throw new CredoError(
      `${this.keyType} public key is neither a valid compressed or uncompressed key. Key prefix '${publicKey[0]}', key length '${publicKey.length}'`
    )
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
