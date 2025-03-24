import type { AgentContext } from '../../agent'
import type { JwkJson } from '../jose'
import type {
  JsonWebKey,
  KeyFormat,
  KeyGenAlgorithm,
  KeyImportParams,
  KeySignParams,
  KeyUsage,
  KeyVerifyParams,
} from './types'

import { p384 } from '@noble/curves/p384'
import { sha256, sha384 } from '@noble/hashes/sha2'
import { AsnConvert, AsnParser } from '@peculiar/asn1-schema'
import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509'

import { Buffer } from '../../utils'
import { Key } from '../Key'
import { getJwkFromJson, getJwkFromKey } from '../jose'

import { p256 } from '@noble/curves/p256'
import { KeyType } from '../KeyType'
import { CredoWebCryptoError } from './CredoWebCryptoError'
import { CredoWebCryptoKey } from './CredoWebCryptoKey'
import { credoKeyTypeIntoSpkiAlgorithm, cryptoKeyAlgorithmToCredoKeyType, spkiAlgorithmIntoCredoKeyType } from './utils'

export class CredoWalletWebCrypto {
  public constructor(private agentContext: AgentContext) {}

  public generateRandomValues<T extends ArrayBufferView | null>(array: T): T {
    if (!array) return array

    return this.agentContext.wallet.getRandomValues(array.byteLength) as unknown as T
  }

  public async sign(key: CredoWebCryptoKey, message: Uint8Array, _algorithm: KeySignParams): Promise<Uint8Array> {
    const signature = await this.agentContext.wallet.sign({
      key: key.key,
      data: Buffer.from(message),
    })

    return signature
  }

  public async verify(
    key: CredoWebCryptoKey,
    algorithm: KeyVerifyParams,
    message: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    if (algorithm.name === 'ECDSA') {
      const hashAlg = typeof algorithm.hash === 'string' ? algorithm.hash : algorithm.hash.name
      if (key.key.keyType === KeyType.P256 && hashAlg !== 'SHA-256') {
        if (hashAlg !== 'SHA-384') {
          throw new CredoWebCryptoError(
            `Hash Alg: ${hashAlg} is not supported with key type ${key.key.keyType} currently`
          )
        }
        return p256.verify(signature, sha384(message), key.key.publicKey)
      }
      if (key.key.keyType === KeyType.P384 && hashAlg !== 'SHA-384') {
        if (hashAlg !== 'SHA-256') {
          throw new CredoWebCryptoError(
            `Hash Alg: ${hashAlg} is not supported with key type ${key.key.keyType} currently`
          )
        }
        return p384.verify(signature, sha256(message), key.key.publicKey)
      }
    }

    const isValidSignature = await this.agentContext.wallet.verify({
      key: key.key,
      signature: Buffer.from(signature),
      data: Buffer.from(message),
    })

    return isValidSignature
  }

  public async generate(algorithm: KeyGenAlgorithm): Promise<Key> {
    const keyType = cryptoKeyAlgorithmToCredoKeyType(algorithm)

    const key = await this.agentContext.wallet.createKey({
      keyType,
    })

    return key
  }

  public async importKey(
    format: KeyFormat,
    keyData: Uint8Array | JsonWebKey,
    algorithm: KeyImportParams,
    extractable: boolean,
    keyUsages: Array<KeyUsage>
  ): Promise<CredoWebCryptoKey> {
    if (format === 'jwk' && keyData instanceof Uint8Array) {
      throw new Error('JWK format is only allowed with a jwk as key data')
    }

    if (format !== 'jwk' && !(keyData instanceof Uint8Array)) {
      throw new Error('non-jwk formats are only allowed with a uint8array as key data')
    }

    switch (format.toLowerCase()) {
      case 'jwk': {
        const jwk = getJwkFromJson(keyData as unknown as JwkJson)
        const publicKey = Key.fromPublicKey(jwk.publicKey, jwk.keyType)
        return new CredoWebCryptoKey(publicKey, algorithm as KeyGenAlgorithm, extractable, 'public', keyUsages)
      }
      case 'spki': {
        const subjectPublicKey = AsnParser.parse(keyData as Uint8Array, SubjectPublicKeyInfo)

        const key = new Uint8Array(subjectPublicKey.subjectPublicKey)

        const keyType = spkiAlgorithmIntoCredoKeyType(subjectPublicKey.algorithm)

        return new CredoWebCryptoKey(
          Key.fromPublicKey(key, keyType),
          algorithm as KeyGenAlgorithm,
          extractable,
          'public',
          keyUsages
        )
      }
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  public async exportKey(format: KeyFormat, key: CredoWebCryptoKey): Promise<Uint8Array | JsonWebKey> {
    switch (format.toLowerCase()) {
      case 'jwk': {
        const jwk = getJwkFromKey(key.key)
        return jwk.toJson() as unknown as JsonWebKey
      }
      case 'spki': {
        const algorithm = credoKeyTypeIntoSpkiAlgorithm(key.key.keyType)

        const publicKeyInfo = new SubjectPublicKeyInfo({
          algorithm,
          subjectPublicKey: key.key.publicKey.buffer,
        })

        const derEncoded = AsnConvert.serialize(publicKeyInfo)
        return new Uint8Array(derEncoded)
      }

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
}
