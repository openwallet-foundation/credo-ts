import type { JwkJson } from './Jwk'
import type { Buffer } from '../../../utils'

import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaKeyType } from '../jwa'
import { JwaSignatureAlgorithm } from '../jwa/alg'

import { Jwk } from './Jwk'
import { hasKty, hasCrv, hasX, hasValidUse } from './validate'

export class Ed25519Jwk extends Jwk {
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

  public get keyType() {
    return KeyType.Ed25519
  }

  public get publicKey() {
    return TypedArrayEncoder.fromBase64(this.x)
  }

  public get supportedEncryptionAlgorithms() {
    return []
  }

  public get supportedSignatureAlgorithms() {
    return [JwaSignatureAlgorithm.EdDSA]
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
