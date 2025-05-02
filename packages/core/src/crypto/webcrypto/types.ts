/*
 *
 * Based on: https://www.w3.org/TR/WebCryptoAPI/
 */

import { KnownJwaSignatureAlgorithm } from '../../modules/kms'
import { JwkJson } from '../jose/jwt/Jwt'
import { CredoWebCryptoError } from './CredoWebCryptoError'
import type { CredoWebCryptoKey } from './CredoWebCryptoKey'

export type CredoWebCryptoKeyPair = {
  publicKey: CredoWebCryptoKey
  privateKey: CredoWebCryptoKey
}

type HashAlgorithmIdentifier = 'SHA-256' | 'SHA-384' | 'SHA-512'

/*
 *
 * Sign and Verify Parameters
 *
 */

export type EcdsaParams = {
  name: 'ECDSA'
  hash: { name: HashAlgorithmIdentifier } | HashAlgorithmIdentifier
}

export type Ed25519Params = { name: 'Ed25519' }

export type RsaSsaParams = {
  name: 'RSASSA-PKCS1-v1_5' | 'RSA-PSS'
  hash: { name: HashAlgorithmIdentifier } | HashAlgorithmIdentifier
  saltLength?: number // Only for RSA-PSS
}

/*
 *
 * Key Generation Parameters
 *
 */

export type Ed25519KeyGenParams = { name: 'Ed25519' }

export type EcKeyGenParams = {
  name: 'ECDSA'
  namedCurve: 'P-256' | 'P-384' | 'P-521' | 'K-256'
}

export type RsaHashedKeyGenParams = {
  name: 'RSASSA-PKCS1-v1_5' | 'RSA-PSS'
  modulusLength: number
  publicExponent: Uint8Array
  hash: { name: HashAlgorithmIdentifier }
}

/*
 *
 * Key Import Parameters
 *
 */

export type Ed25519KeyImportParams = { name: 'Ed25519' }

export type EcKeyImportParams = {
  name: 'ECDSA'
  namedCurve: 'P-256' | 'P-384' | 'K-256' | 'P-521'
}

export type RsaHashedImportParams = {
  name: 'RSASSA-PKCS1-v1_5' | 'RSA-PSS'
  hash: { name: HashAlgorithmIdentifier }
}

export type KeyUsage = 'sign' | 'verify' | 'encrypt' | 'decrypt' | 'wrapKey' | 'unwrapKey' | 'deriveKey' | 'deriveBits'
export type KeyFormat = 'jwk' | 'pkcs8' | 'spki' | 'raw'
export type KeyType = 'private' | 'public' | 'secret'

export type JsonWebKey = JwkJson

export type HashAlgorithm = { name: HashAlgorithmIdentifier }

export type KeyImportParams = EcKeyImportParams | Ed25519KeyImportParams | RsaHashedImportParams
export type KeyGenAlgorithm = EcKeyGenParams | Ed25519KeyGenParams | RsaHashedKeyGenParams
export type KeySignParams = EcdsaParams | Ed25519Params | RsaSsaParams
export type KeyVerifyParams = EcdsaParams | Ed25519Params | RsaSsaParams

/**
 * Derives the JWA algorithm name from KeySignParams or KeyVerifyParams
 * @param params - The signing or verification parameters
 * @returns The corresponding JWA algorithm string
 */
export function keyParamsToJwaAlgorithm(params: KeySignParams | KeyVerifyParams): KnownJwaSignatureAlgorithm {
  if (params.name === 'Ed25519') {
    return 'EdDSA'
  }

  if (params.name === 'ECDSA') {
    // Normalize hash parameter
    const hashName = typeof params.hash === 'string' ? params.hash : params.hash.name

    // Map ECDSA with different hash algorithms to JWA names
    switch (hashName) {
      case 'SHA-256':
        return 'ES256'
      case 'SHA-384':
        return 'ES384'
      case 'SHA-512':
        return 'ES512'
      default:
        throw new CredoWebCryptoError(`Unsupported hash algorithm for ECDSA: ${hashName}`)
    }
  }

  if (params.name === 'RSASSA-PKCS1-v1_5') {
    // Normalize hash parameter
    const hashName = typeof params.hash === 'string' ? params.hash : params.hash.name

    // Map RSA-PKCS1 with different hash algorithms to JWA names
    switch (hashName) {
      case 'SHA-256':
        return 'RS256'
      case 'SHA-384':
        return 'RS384'
      case 'SHA-512':
        return 'RS512'
      default:
        throw new CredoWebCryptoError(`Unsupported hash algorithm for RSASSA-PKCS1-v1_5: ${hashName}`)
    }
  }

  if (params.name === 'RSA-PSS') {
    // Normalize hash parameter
    const hashName = typeof params.hash === 'string' ? params.hash : params.hash.name

    // Map RSA-PSS with different hash algorithms to JWA names
    switch (hashName) {
      case 'SHA-256':
        return 'PS256'
      case 'SHA-384':
        return 'PS384'
      case 'SHA-512':
        return 'PS512'
      default:
        throw new Error(`Unsupported hash algorithm for RSA-PSS: ${hashName}`)
    }
  }

  throw new Error(`Unsupported algorithm: ${params.name}`)
}
