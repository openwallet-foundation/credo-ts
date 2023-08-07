import type { JwkJson } from './Jwk'
import type { Buffer } from '../../../utils'
import type { JwaEncryptionAlgorithm } from '../jwa/alg'

import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { hasKty, hasCrv, hasX, hasValidUse } from './validate'

export class Ed25519Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = []
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = [JwaSignatureAlgorithm.EdDSA]
  public static readonly keyType = KeyType.Ed25519

  public readonly x: string

  public constructor({ x }: { x: string }) {
    super()

    this.x = x
  }

  public get kty() {
    return JwaKeyType.OKP as const
  }

  public get crv() {
    return JwaCurve.Ed25519 as const
  }

  public get publicKey() {
    return TypedArrayEncoder.fromBase64(this.x)
  }

  public get keyType() {
    return Ed25519Jwk.keyType
  }

  public get supportedEncryptionAlgorithms() {
    return Ed25519Jwk.supportedEncryptionAlgorithms
  }

  public get supportedSignatureAlgorithms() {
    return Ed25519Jwk.supportedSignatureAlgorithms
  }

  public toJson() {
    return {
      ...super.toJson(),
      crv: this.crv,
      x: this.x,
    } as Ed25519JwkJson
  }

  public static fromJson(jwkJson: JwkJson) {
    if (!isValidEd25519JwkPublicKey(jwkJson)) {
      throw new Error("Invalid 'Ed25519' JWK.")
    }

    return new Ed25519Jwk({
      x: jwkJson.x,
    })
  }

  public static fromPublicKey(publicKey: Buffer) {
    return new Ed25519Jwk({
      x: TypedArrayEncoder.toBase64URL(publicKey),
    })
  }
}

export interface Ed25519JwkJson extends JwkJson {
  kty: JwaKeyType.OKP
  crv: JwaCurve.Ed25519
  x: string
  use?: 'sig'
}

function isValidEd25519JwkPublicKey(jwk: JwkJson): jwk is Ed25519JwkJson {
  return (
    hasKty(jwk, JwaKeyType.OKP) &&
    hasCrv(jwk, JwaCurve.Ed25519) &&
    hasX(jwk) &&
    hasValidUse(jwk, {
      supportsEncrypting: false,
      supportsSigning: true,
    })
  )
}
