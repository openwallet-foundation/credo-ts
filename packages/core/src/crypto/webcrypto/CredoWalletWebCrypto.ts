import type { AgentContext } from '../../agent'
import {
  type JsonWebKey,
  type KeyFormat,
  type KeyGenAlgorithm,
  type KeyImportParams,
  type KeySignParams,
  type KeyUsage,
  type KeyVerifyParams,
  keyParamsToJwaAlgorithm,
} from './types'

import { p384 } from '@noble/curves/p384'
import { sha256, sha384 } from '@noble/hashes/sha2'
import { AsnConvert, AsnParser } from '@peculiar/asn1-schema'
import { SubjectPublicKeyInfo } from '@peculiar/asn1-x509'

import { p256 } from '@noble/curves/p256'
import { KeyManagementApi, PublicJwk } from '../../modules/kms'
import { CredoWebCryptoError } from './CredoWebCryptoError'
import { CredoWebCryptoKey } from './CredoWebCryptoKey'
import { cryptoKeyAlgorithmToCreateKeyOptions, publicJwkToSpki, spkiToPublicJwk } from './utils'

export class CredoWalletWebCrypto {
  private kms: KeyManagementApi

  public constructor(private agentContext: AgentContext) {
    this.kms = agentContext.resolve(KeyManagementApi)
  }

  public generateRandomValues<T extends ArrayBufferView | null>(array: T): T {
    if (!array) return array

    return this.kms.randomBytes({ length: array.byteLength }) as unknown as T
  }

  public async sign(key: CredoWebCryptoKey, message: Uint8Array, algorithm: KeySignParams): Promise<Uint8Array> {
    const jwaAlgorithm = keyParamsToJwaAlgorithm(algorithm, key)

    const keyId = key.publicJwk.keyId
    const { signature } = await this.kms.sign({
      keyId,
      data: message,
      algorithm: jwaAlgorithm,
    })

    return signature
  }

  public async verify(
    key: CredoWebCryptoKey,
    algorithm: KeyVerifyParams,
    message: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    const publicKey = key.publicJwk.publicKey

    // TODO: with new KMS api we can now define custom algorithms
    // such as ES256-SHA384 to support these non-standard JWA combinatiosn
    // or we can do something like ES256-ph (pre-hashed for more generic)
    if (algorithm.name === 'ECDSA') {
      const hashAlg = typeof algorithm.hash === 'string' ? algorithm.hash : algorithm.hash.name
      if (publicKey.kty === 'EC' && publicKey.crv === 'P-256' && hashAlg !== 'SHA-256') {
        if (hashAlg !== 'SHA-384') {
          throw new CredoWebCryptoError(
            `Hash Alg: ${hashAlg} is not supported with key type ${publicKey.crv} currently`
          )
        }
        return p256.verify(signature, sha384(message), publicKey.publicKey)
      }
      if (publicKey.kty === 'EC' && publicKey.crv === 'P-384' && hashAlg !== 'SHA-384') {
        if (hashAlg !== 'SHA-256') {
          throw new CredoWebCryptoError(
            `Hash Alg: ${hashAlg} is not supported with key type ${publicKey.crv} currently`
          )
        }
        return p384.verify(signature, sha256(message), publicKey.publicKey)
      }
    }

    const jwaAlgorithm = keyParamsToJwaAlgorithm(algorithm, key)
    const { verified } = await this.kms.verify({
      key: {
        publicJwk: key.publicJwk.toJson(),
      },
      algorithm: jwaAlgorithm,
      signature,
      data: message,
    })

    return verified
  }

  public async generate(algorithm: KeyGenAlgorithm) {
    const key = await this.kms.createKey({
      type: cryptoKeyAlgorithmToCreateKeyOptions(algorithm),
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
        const publicJwk = PublicJwk.fromUnknown(keyData)
        return new CredoWebCryptoKey(publicJwk, algorithm as KeyGenAlgorithm, extractable, 'public', keyUsages)
      }
      case 'spki': {
        const subjectPublicKey = AsnParser.parse(keyData as Uint8Array, SubjectPublicKeyInfo)
        const publicJwk = spkiToPublicJwk(subjectPublicKey)

        return new CredoWebCryptoKey(publicJwk, algorithm as KeyGenAlgorithm, extractable, 'public', keyUsages)
      }
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  public async exportKey(format: KeyFormat, key: CredoWebCryptoKey): Promise<Uint8Array | JsonWebKey> {
    switch (format.toLowerCase()) {
      case 'jwk': {
        return key.publicJwk.toJson()
      }
      case 'spki': {
        const publicKeyInfo = publicJwkToSpki(key.publicJwk)

        const derEncoded = AsnConvert.serialize(publicKeyInfo)
        return new Uint8Array(derEncoded)
      }

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
}
