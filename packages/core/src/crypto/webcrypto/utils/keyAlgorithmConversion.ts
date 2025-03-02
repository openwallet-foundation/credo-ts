import type { AlgorithmIdentifier } from '@peculiar/asn1-x509'
import type { EcKeyGenParams, KeyGenAlgorithm } from '../types'

import { KeyType } from '../../KeyType'
import { CredoWebCryptoError } from '../CredoWebCryptoError'
import {
  ecPublicKeyWithK256AlgorithmIdentifier,
  ecPublicKeyWithP256AlgorithmIdentifier,
  ecPublicKeyWithP384AlgorithmIdentifier,
  ed25519AlgorithmIdentifier,
  x25519AlgorithmIdentifier,
} from '../algorithmIdentifiers'

export const credoKeyTypeIntoCryptoKeyAlgorithm = (keyType: KeyType): KeyGenAlgorithm => {
  switch (keyType) {
    case KeyType.Ed25519:
      return { name: 'Ed25519' }
    case KeyType.P256:
      return { name: 'ECDSA', namedCurve: 'P-256' }
    case KeyType.P384:
      return { name: 'ECDSA', namedCurve: 'P-384' }
    case KeyType.K256:
      return { name: 'ECDSA', namedCurve: 'K-256' }
    default:
      throw new CredoWebCryptoError(`Unsupported key type: ${keyType}`)
  }
}

export const cryptoKeyAlgorithmToCredoKeyType = (algorithm: KeyGenAlgorithm): KeyType => {
  const algorithmName = algorithm.name.toUpperCase()
  switch (algorithmName) {
    case 'ED25519':
      return KeyType.Ed25519
    case 'X25519':
      return KeyType.X25519
    case 'ECDSA':
      switch ((algorithm as EcKeyGenParams).namedCurve.toUpperCase()) {
        case 'P-256':
          return KeyType.P256
        case 'P-384':
          return KeyType.P384
        case 'K-256':
          return KeyType.K256
        default:
          throw new CredoWebCryptoError(`Unsupported curve for ECDSA: ${(algorithm as EcKeyGenParams).namedCurve}`)
      }
  }
  throw new CredoWebCryptoError(`Unsupported algorithm: ${algorithmName}`)
}

export const spkiAlgorithmIntoCredoKeyType = (algorithm: AlgorithmIdentifier): KeyType => {
  if (algorithm.isEqual(ecPublicKeyWithP256AlgorithmIdentifier)) {
    return KeyType.P256
  }
  if (algorithm.isEqual(ecPublicKeyWithP384AlgorithmIdentifier)) {
    return KeyType.P384
  }
  if (algorithm.isEqual(ecPublicKeyWithK256AlgorithmIdentifier)) {
    return KeyType.K256
  }
  if (algorithm.isEqual(ed25519AlgorithmIdentifier)) {
    return KeyType.Ed25519
  }
  if (algorithm.isEqual(x25519AlgorithmIdentifier)) {
    return KeyType.X25519
  }

  throw new CredoWebCryptoError(
    `Unsupported algorithm: ${algorithm.algorithm}, with params: ${algorithm.parameters ? 'yes' : 'no'}`
  )
}

export const credoKeyTypeIntoSpkiAlgorithm = (keyType: KeyType): AlgorithmIdentifier => {
  switch (keyType) {
    case KeyType.Ed25519:
      return ed25519AlgorithmIdentifier
    case KeyType.X25519:
      return x25519AlgorithmIdentifier
    case KeyType.P256:
      return ecPublicKeyWithP256AlgorithmIdentifier
    case KeyType.P384:
      return ecPublicKeyWithP384AlgorithmIdentifier
    case KeyType.K256:
      return ecPublicKeyWithK256AlgorithmIdentifier
    default:
      throw new CredoWebCryptoError(`Unsupported key type: ${keyType}`)
  }
}
