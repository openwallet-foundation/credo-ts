import type { KeyType } from '.'

import { varint } from 'multiformats'

import { Buffer, BufferEncoder, MultiBaseEncoder } from '../utils'

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
    const publicKeyBytes = BufferEncoder.fromBase58(publicKey)

    return Key.fromPublicKey(publicKeyBytes, keyType)
  }

  public static fromFingerprint(fingerprint: string) {
    const { data } = MultiBaseEncoder.decode(fingerprint)
    const [code, byteLength] = varint.decode(data)

    const publicKey = Buffer.from(data.slice(byteLength))
    const keyType = getKeyTypeByMultiCodecPrefix(code)

    return new Key(publicKey, keyType)
  }

  public get prefixedPublicKey() {
    const multiCodecPrefix = getMultiCodecPrefixByKeytype(this.keyType)

    // Create Uint8Array with length of the prefix bytes, then use varint to fill the prefix bytes
    const prefixBytes = varint.encodeTo(multiCodecPrefix, new Uint8Array(varint.encodingLength(multiCodecPrefix)))

    // Combine prefix with public key
    return Buffer.concat([prefixBytes, this.publicKey])
  }

  public get fingerprint() {
    return `z${BufferEncoder.toBase58(this.prefixedPublicKey)}`
  }

  public get publicKeyBase58() {
    return BufferEncoder.toBase58(this.publicKey)
  }
}
