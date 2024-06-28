/*
 *
 * Based on: https://www.w3.org/TR/WebCryptoAPI/
 */

import type { CredoWebCryptoKey } from './CredoWebCryptoKey'
import type { JwkJson } from '../jose'

export type CredoWebCryptoKeyPair = {
  publicKey: CredoWebCryptoKey
  privateKey: CredoWebCryptoKey
}

type HashAlgorithmIdentifier = 'SHA-256'

/*
 *
 * Sign and Verify Parameters
 *
 */

export type EcdsaParams = {
  name: 'ECDSA'
  hash: { name: HashAlgorithmIdentifier } | HashAlgorithmIdentifier
}

export type Ed25519Params = 'Ed25519'

/*
 *
 * Key Generation Parameters
 *
 */

export type Ed25519KeyGenParams = 'Ed25119'

export type EcKeyGenParams = {
  name: 'ECDSA'
  namedCurve: 'P-256' | 'P-384' | 'K-256'
}

/*
 *
 * Key Import Parameters
 *
 */

export type Ed25519KeyImportParams = 'Ed25519'

export type EcKeyImportParams = {
  name: 'ECDSA'
  namedCurve: 'P-256' | 'P-384' | 'K-256'
}

export type KeyUsage = 'sign' | 'verify'
export type KeyFormat = 'jwk' | 'pkcs8' | 'spki' | 'raw'
export type KeyType = 'private' | 'public' | 'secret'

export type JsonWebKey = JwkJson

export type HashAlgorithm = { name: 'SHA-1' }

export type KeyImportParams = EcKeyImportParams | Ed25519KeyImportParams
export type KeyGenAlgorithm = EcKeyGenParams | Ed25519KeyGenParams
export type KeySignParams = EcdsaParams | Ed25519Params
export type KeyVerifyParams = EcdsaParams | Ed25519Params
