import type { JwkJson } from './Jwk'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import {
  AffinePoint,
  isValidCompressedPublicKeyFormat,
  isValidDecompressedPublicKeyFormat,
  Secp256k1,
} from 'ec-compression'

import { CredoError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { hasKty, hasCrv, hasX, hasY, hasValidUse } from './validate'

export class K256Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.ES256K]
  public static readonly keyType = KeyType.K256

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
    return JwaCurve.Secp256k1 as const
  }

  public get x() {
    return TypedArrayEncoder.toBase64URL(this.affinePoint.xBytes)
  }

  public get y() {
    return TypedArrayEncoder.toBase64URL(this.affinePoint.yBytes)
  }

  /**
   * Returns the uncompressed public key of the P-256 JWK.
   */
  public get publicKey() {
    return this.affinePoint.decompressedForm
  }

  /**
   * Returns the compressed public key of the K-256 JWK.
   */
  public get publicKeyCompressed() {
    return this.affinePoint.compressedForm
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

  public static fromPublicKey(publicKey: Uint8Array) {
    if (isValidCompressedPublicKeyFormat(publicKey, Secp256k1)) {
      const affinePoint = AffinePoint.fromCompressedPoint(publicKey, Secp256k1)
      return new K256Jwk({ x: affinePoint.xBytes, y: affinePoint.yBytes })
    }

    if (isValidDecompressedPublicKeyFormat(publicKey, Secp256k1)) {
      const affinePoint = AffinePoint.fromDecompressedPoint(publicKey, Secp256k1)
      return new K256Jwk({ x: affinePoint.xBytes, y: affinePoint.yBytes })
    }

    throw new CredoError(
      `${this.keyType} public key is neither a valid compressed or uncompressed key. Key prefix '${publicKey[0]}', key length '${publicKey.length}'`
    )
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
