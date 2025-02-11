import type { JwkJson } from './Jwk'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import {
  AffinePoint,
  isValidCompressedPublicKeyFormat,
  isValidDecompressedPublicKeyFormat,
  Secp521r1,
} from 'ec-compression'

import { CredoError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { hasKty, hasCrv, hasX, hasY, hasValidUse } from './validate'

export class P521Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.ES512]
  public static readonly keyType = KeyType.P521

  private readonly affinePoint: AffinePoint

  public constructor({ x, y }: { x: string | Uint8Array; y: string | Uint8Array }) {
    super()

    const xAsBytes = typeof x === 'string' ? Uint8Array.from(TypedArrayEncoder.fromBase64(x)) : x
    const yAsBytes = typeof y === 'string' ? Uint8Array.from(TypedArrayEncoder.fromBase64(y)) : y

    this.affinePoint = new AffinePoint(xAsBytes, yAsBytes)
  }

  public get kty() {
    return JwaKeyType.EC as const
  }

  public get crv() {
    return JwaCurve.P521 as const
  }

  public get keyType() {
    return P521Jwk.keyType
  }

  public get supportedEncryptionAlgorithms() {
    return P521Jwk.supportedEncryptionAlgorithms
  }

  public get supportedSignatureAlgorithms() {
    return P521Jwk.supportedSignatureAlgorithms
  }

  public get x() {
    return TypedArrayEncoder.toBase64URL(this.affinePoint.xBytes)
  }

  public get y() {
    return TypedArrayEncoder.toBase64URL(this.affinePoint.yBytes)
  }

  /**
   * Returns the uncompressed public key of the P-521 JWK.
   */
  public get publicKey() {
    return this.affinePoint.decompressedForm
  }

  /**
   * Returns the compressed public key of the P-521 JWK.
   */
  public get publicKeyCompressed() {
    return this.affinePoint.compressedForm
  }

  public toJson() {
    return {
      ...super.toJson(),
      crv: this.crv,
      x: this.x,
      y: this.y,
    } as P521JwkJson
  }

  public static fromJson(jwk: JwkJson) {
    if (!isValidP521JwkPublicKey(jwk)) {
      throw new Error("Invalid 'P-521' JWK.")
    }

    return new P521Jwk({
      x: jwk.x,
      y: jwk.y,
    })
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    if (isValidCompressedPublicKeyFormat(publicKey, Secp521r1)) {
      const affinePoint = AffinePoint.fromCompressedPoint(publicKey, Secp521r1)
      return new P521Jwk({ x: affinePoint.xBytes, y: affinePoint.yBytes })
    }

    if (isValidDecompressedPublicKeyFormat(publicKey, Secp521r1)) {
      const affinePoint = AffinePoint.fromDecompressedPoint(publicKey, Secp521r1)
      return new P521Jwk({ x: affinePoint.xBytes, y: affinePoint.yBytes })
    }

    throw new CredoError(
      `${this.keyType} public key is neither a valid compressed or uncompressed key. Key prefix '${publicKey[0]}', key length '${publicKey.length}'`
    )
  }
}

export interface P521JwkJson extends JwkJson {
  kty: JwaKeyType.EC
  crv: JwaCurve.P521
  x: string
  y: string
  use?: 'sig' | 'enc'
}

export function isValidP521JwkPublicKey(jwk: JwkJson): jwk is P521JwkJson {
  return (
    hasKty(jwk, JwaKeyType.EC) &&
    hasCrv(jwk, JwaCurve.P521) &&
    hasX(jwk) &&
    hasY(jwk) &&
    hasValidUse(jwk, {
      supportsEncrypting: true,
      supportsSigning: true,
    })
  )
}
