import type { JwaSignatureAlgorithm } from '../jwa'
import type { JwkJson } from './Jwk'

import { TypedArrayEncoder } from '../../../utils'
import { KeyType } from '../../KeyType'
import { JwaCurve, JwaEncryptionAlgorithm, JwaKeyType } from '../jwa'

import { Jwk } from './Jwk'
import { hasCrv, hasKty, hasValidUse, hasX } from './validate'

export class X25519Jwk extends Jwk {
  public static readonly supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[] = [
    JwaEncryptionAlgorithm.ECDHESA128KW,
    JwaEncryptionAlgorithm.ECDHESA192KW,
    JwaEncryptionAlgorithm.ECDHESA256KW,
    JwaEncryptionAlgorithm.ECDHES,
  ]
  public static readonly supportedSignatureAlgorithms: JwaSignatureAlgorithm[] = []
  public static readonly keyType = KeyType.X25519

  private readonly _x: Uint8Array

  public constructor({ x }: { x: string | Uint8Array }) {
    super()

    this._x = typeof x === 'string' ? Uint8Array.from(TypedArrayEncoder.fromBase64(x)) : x
  }

  public get x() {
    return TypedArrayEncoder.toBase64URL(this._x)
  }

  public get kty() {
    return JwaKeyType.OKP as const
  }

  public get crv() {
    return JwaCurve.X25519 as const
  }

  public get keyType() {
    return X25519Jwk.keyType
  }

  public get supportedEncryptionAlgorithms() {
    return X25519Jwk.supportedEncryptionAlgorithms
  }

  public get supportedSignatureAlgorithms() {
    return X25519Jwk.supportedSignatureAlgorithms
  }

  public get publicKey() {
    return this._x
  }

  public toJson() {
    return {
      ...super.toJson(),
      crv: this.crv,
      x: this.x,
    } as X25519JwkJson
  }

  public static fromJson(jwk: JwkJson) {
    if (!isValidX25519JwkPublicKey(jwk)) {
      throw new Error("Invalid 'X25519' JWK.")
    }

    return new X25519Jwk({
      x: jwk.x,
    })
  }

  public static fromPublicKey(publicKey: Uint8Array) {
    return new X25519Jwk({ x: publicKey })
  }
}

export interface X25519JwkJson extends JwkJson {
  kty: JwaKeyType.OKP
  crv: JwaCurve.X25519
  x: string
  use?: 'enc'
}

function isValidX25519JwkPublicKey(jwk: JwkJson): jwk is X25519JwkJson {
  return (
    hasKty(jwk, JwaKeyType.OKP) &&
    hasCrv(jwk, JwaCurve.X25519) &&
    hasX(jwk) &&
    hasValidUse(jwk, {
      supportsEncrypting: true,
      supportsSigning: false,
    })
  )
}
