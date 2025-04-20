import { MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../../../utils'
import { Constructor } from '../../../utils/mixins'
import { parseWithErrorHandling } from '../../../utils/zod'
import { KeyManagementError } from '../error/KeyManagementError'
import { legacyKeyIdFromPublicJwk } from '../legacy'
import { assymetricPublicJwkMatches } from './equals'
import { getJwkHumanDescription } from './humanDescription'
import { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from './jwa'
import { KmsJwkPublicAsymmetric, assertJwkAsymmetric, publicJwkFromPrivateJwk, zKmsJwkPublic } from './knownJwk'

import {
  Ed25519PublicJwk,
  P256PublicJwk,
  P384PublicJwk,
  P521PublicJwk,
  RsaPublicJwk,
  Secp256k1PublicJwk,
  X25519PublicJwk,
} from './kty'

export const SupportedPublicJwks = [
  Ed25519PublicJwk,
  P256PublicJwk,
  P384PublicJwk,
  P521PublicJwk,
  RsaPublicJwk,
  Secp256k1PublicJwk,
  X25519PublicJwk,
]
export type SupportedPublicJwk =
  | Ed25519PublicJwk
  | P256PublicJwk
  | P384PublicJwk
  | P521PublicJwk
  | RsaPublicJwk
  | Secp256k1PublicJwk
  | X25519PublicJwk

type ExtractByJwk<T, K> = T extends { jwk: infer J } ? (K extends J ? T : never) : never

export class PublicJwk<Jwk extends SupportedPublicJwk = SupportedPublicJwk> {
  private constructor(public readonly jwk: Jwk) {}

  public static fromUnknown(jwkJson: unknown) {
    // We remove any private properties if they are present
    const publicJwk = publicJwkFromPrivateJwk(parseWithErrorHandling(zKmsJwkPublic, jwkJson, 'jwk is not a valid jwk'))
    assertJwkAsymmetric(publicJwk)

    let jwkInstance: SupportedPublicJwk
    if (publicJwk.kty === 'RSA') {
      jwkInstance = new RsaPublicJwk(publicJwk)
    } else if (publicJwk.kty === 'EC') {
      if (publicJwk.crv === 'P-256') {
        jwkInstance = new P256PublicJwk({
          ...publicJwk,
          crv: publicJwk.crv,
        })
      } else if (publicJwk.crv === 'P-384') {
        jwkInstance = new P384PublicJwk({
          ...publicJwk,
          crv: publicJwk.crv,
        })
      } else if (publicJwk.crv === 'P-521') {
        jwkInstance = new P521PublicJwk({
          ...publicJwk,
          crv: publicJwk.crv,
        })
      } else if (publicJwk.crv === 'secp256k1') {
        jwkInstance = new Secp256k1PublicJwk({
          ...publicJwk,
          crv: publicJwk.crv,
        })
      } else {
        throw new KeyManagementError(
          `Unsupported kty '${publicJwk.kty}' with crv '${publicJwk.crv}' for creating jwk instance`
        )
      }
    } else if (publicJwk.crv === 'Ed25519') {
      jwkInstance = new Ed25519PublicJwk({
        ...publicJwk,
        crv: publicJwk.crv,
      })
    } else if (publicJwk.crv === 'X25519') {
      jwkInstance = new X25519PublicJwk({
        ...publicJwk,
        crv: publicJwk.crv,
      })
    } else {
      throw new KeyManagementError(`Unsupported kty '${publicJwk.kty}' for creating jwk instance`)
    }

    return new PublicJwk(jwkInstance)
  }

  public static fromPublicJwk<Jwk extends KmsJwkPublicAsymmetric>(jwk: Jwk) {
    return PublicJwk.fromUnknown(jwk) as PublicJwk<
      ExtractByJwk<SupportedPublicJwk, Jwk> extends never ? SupportedPublicJwk : ExtractByJwk<SupportedPublicJwk, Jwk>
    >
  }

  public toJson(): Jwk['jwk'] {
    return this.jwk.jwk
  }

  public get supportedSignatureAlgorithms(): KnownJwaSignatureAlgorithm[] {
    return this.jwk.supportedSignatureAlgorithms ?? []
  }

  public get supportdEncryptionKeyAgreementAlgorithms(): KnownJwaKeyAgreementAlgorithm[] {
    return this.jwk.supportdEncryptionKeyAgreementAlgorithms ?? []
  }

  /**
   * key type as defined in [JWA Specification](https://tools.ietf.org/html/rfc7518#section-6.1)
   */
  public get kty(): Jwk['jwk']['kty'] {
    return this.jwk.jwk.kty
  }

  /**
   * Get the key id for a public jwk. If the public jwk does not have
   */
  public get keyId(): string {
    if (this.jwk.jwk.kid) return this.jwk.jwk.kid

    throw new KeyManagementError('Unable to determine keyId for jwk')
  }

  public set keyId(keyId: string) {
    this.jwk.jwk.kid = keyId
  }

  public get legacyKeyId() {
    return legacyKeyIdFromPublicJwk(this)
  }

  public get publicKey(): Jwk['publicKey'] {
    return this.jwk.publicKey
  }

  /**
   * Get the signature algorithm to use with this jwk. If the jwk has an `alg` field defined
   * it will use that alg, and otherwise fall back to the first supported signature algorithm.
   *
   * If no algorithm is supported it will throw an error
   */
  public get signatureAlgorithm() {
    if (this.jwk.jwk.alg) {
      if (!this.supportedSignatureAlgorithms.includes(this.jwk.jwk.alg as KnownJwaSignatureAlgorithm)) {
        throw new KeyManagementError(
          `${getJwkHumanDescription(this.jwk.jwk)} defines alg '${this.jwk.jwk.alg}' but this alg is not supported.`
        )
      }

      return this.jwk.jwk.alg as this['supportedSignatureAlgorithms'][number]
    }

    const alg = this.supportedSignatureAlgorithms[0]
    if (!alg) {
      throw new KeyManagementError(`${getJwkHumanDescription(this.jwk.jwk)} has no supported signature algorithms`)
    }

    return alg as this['supportedSignatureAlgorithms'][number]
  }

  public static fromPublicKey<Supported extends SupportedPublicJwk>(publicKey: Supported['publicKey']) {
    let jwkInstance: SupportedPublicJwk

    if (publicKey.kty === 'RSA') {
      jwkInstance = RsaPublicJwk.fromPublicKey(publicKey)
    } else if (publicKey.kty === 'EC') {
      if (publicKey.crv === 'P-256') {
        jwkInstance = P256PublicJwk.fromPublicKey(publicKey.publicKey)
      } else if (publicKey.crv === 'P-384') {
        jwkInstance = P384PublicJwk.fromPublicKey(publicKey.publicKey)
      } else if (publicKey.crv === 'P-521') {
        jwkInstance = P521PublicJwk.fromPublicKey(publicKey.publicKey)
      } else if (publicKey.crv === 'secp256k1') {
        jwkInstance = Secp256k1PublicJwk.fromPublicKey(publicKey.publicKey)
      } else {
        throw new KeyManagementError(
          // @ts-expect-error
          `Unsupported kty '${publicKey.kty}' with crv '${publicKey.crv}' for creating jwk instance based on public key bytes`
        )
      }
    } else if (publicKey.crv === 'X25519') {
      jwkInstance = X25519PublicJwk.fromPublicKey(publicKey.publicKey)
    } else if (publicKey.crv === 'Ed25519') {
      jwkInstance = Ed25519PublicJwk.fromPublicKey(publicKey.publicKey)
    } else {
      throw new KeyManagementError(
        // @ts-expect-error
        `Unsupported kty '${publicKey.kty}' for creating jwk instance based on public key bytes`
      )
    }

    return new PublicJwk(jwkInstance) as PublicJwk<Supported>
  }

  /**
   * Returns the jwk encoded a Base58 multibase encoded multicodec key
   */
  public get fingerprint() {
    const prefixBytes = VarintEncoder.encode(this.jwk.multicodecPrefix)
    const prefixedPublicKey = new Uint8Array([...prefixBytes, ...this.jwk.multicodec])

    return `z${TypedArrayEncoder.toBase58(prefixedPublicKey)}`
  }

  /**
   * Create a jwk instance based on a Base58 multibase encoded multicodec key
   */
  public static fromFingerprint(fingerprint: string) {
    const { data } = MultiBaseEncoder.decode(fingerprint)
    const [code, byteLength] = VarintEncoder.decode(data)
    const publicKey = data.slice(byteLength)

    const PublicJwkClass = SupportedPublicJwks.find((JwkClass) => JwkClass.multicodecPrefix === code)
    if (!PublicJwkClass) {
      throw new KeyManagementError(`Unsupported multicodec public key with prefix '${code}'`)
    }

    const jwk = PublicJwkClass.fromMulticodec(publicKey)
    return new PublicJwk(jwk)
  }

  /**
   * Check whether this PublicJwk instance is of a specific type
   */
  public is<
    Jwk1 extends SupportedPublicJwk,
    Jwk2 extends SupportedPublicJwk = Jwk1,
    Jwk3 extends SupportedPublicJwk = Jwk1,
  >(
    jwkType1: Constructor<Jwk1>,
    jwkType2?: Constructor<Jwk2>,
    jwkType3?: Constructor<Jwk3>
  ): this is PublicJwk<Jwk1> | PublicJwk<Jwk2> | PublicJwk<Jwk3> {
    const types = [jwkType1, jwkType2, jwkType3].filter(Boolean) as Constructor<SupportedPublicJwk>[]
    return types.some((type) => this.jwk.constructor === type)
  }

  /**
   * Check whether this jwk instance is the same as another jwk instance.
   * It does this by comparing the key types and public keys, not other fields
   * of the JWK such as keyId, use, etc..
   */
  public equals(other: PublicJwk) {
    return assymetricPublicJwkMatches(this.toJson(), other.toJson())
  }

  /**
   * Get human description of a jwk type. This does
   * not include the (public) key material
   */
  public get jwkTypehumanDescription() {
    return getJwkHumanDescription(this.toJson())
  }
}
