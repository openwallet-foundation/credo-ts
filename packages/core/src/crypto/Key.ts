import type { Jwk } from './JwkTypes'

import { AriesFrameworkError } from '../error'
import { Buffer, MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../utils'

import { KeyType } from './KeyType'
import { getKeyTypeByMultiCodecPrefix, getMultiCodecPrefixByKeytype } from './multiCodecKey'

export class Key {
  public readonly publicKey: Buffer
  public readonly keyType: KeyType

  public constructor(publicKey: Uint8Array, keyType: KeyType) {
    this.publicKey = Buffer.from(publicKey)
    this.keyType = keyType
  }

  public static fromPublicKey(publicKey: Uint8Array, keyType: KeyType) {
    return new Key(Buffer.from(publicKey), keyType)
  }

  public static fromPublicKeyBase58(publicKey: string, keyType: KeyType) {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(publicKey)

    return Key.fromPublicKey(publicKeyBytes, keyType)
  }

  public static fromFingerprint(fingerprint: string) {
    const { data } = MultiBaseEncoder.decode(fingerprint)
    const [code, byteLength] = VarintEncoder.decode(data)

    const publicKey = Buffer.from(data.slice(byteLength))
    const keyType = getKeyTypeByMultiCodecPrefix(code)

    return new Key(publicKey, keyType)
  }

  public get prefixedPublicKey() {
    const multiCodecPrefix = getMultiCodecPrefixByKeytype(this.keyType)

    // Create Buffer with length of the prefix bytes, then use varint to fill the prefix bytes
    const prefixBytes = VarintEncoder.encode(multiCodecPrefix)

    // Combine prefix with public key
    return Buffer.concat([prefixBytes, this.publicKey])
  }

  public get fingerprint() {
    return `z${TypedArrayEncoder.toBase58(this.prefixedPublicKey)}`
  }

  public get publicKeyBase58() {
    return TypedArrayEncoder.toBase58(this.publicKey)
  }

  public toJwk(): Jwk {
    if (this.keyType !== KeyType.Ed25519) {
      throw new AriesFrameworkError(`JWK creation is only supported for Ed25519 key types. Received ${this.keyType}`)
    }

    return {
      kty: 'OKP',
      crv: 'Ed25519',
      x: TypedArrayEncoder.toBase64URL(this.publicKey),
    }
  }

  public static fromJwk(jwk: Jwk) {
    if (jwk.crv !== 'Ed25519') {
      throw new AriesFrameworkError('Only JWKs with Ed25519 key type is supported.')
    }
    return Key.fromPublicKeyBase58(TypedArrayEncoder.toBase58(TypedArrayEncoder.fromBase64(jwk.x)), KeyType.Ed25519)
  }
}
