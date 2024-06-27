import type { EcKeyGenParams, KeyGenAlgorithm } from '../types'
import type { AlgorithmIdentifier } from '@peculiar/asn1-x509'

import { ecdsaWithSHA256 } from '@peculiar/asn1-ecc'

import { KeyType } from '../../KeyType'
import { CredoWebCryptoError } from '../CredoWebCryptoError'
import {
  ecdsaWithSha256AndK256AlgorithmIdentifier,
  ecdsaWithSha256AndP256AlgorithmIdentifier,
  ecdsaWithSha256AndP384AlgorithmIdentifier,
  ed25519AlgorithmIdentifier,
  x25519AlgorithmIdentifier,
} from '../algorithmIdentifiers'

export const cryptoKeyAlgorithmToCredoKeyType = (algorithm: KeyGenAlgorithm): KeyType => {
  const algorithmName = typeof algorithm === 'string' ? algorithm.toUpperCase() : algorithm.name.toUpperCase()
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
    default:
      throw new CredoWebCryptoError(`Unsupported algorithm: ${algorithmName}`)
  }
}

export const spkiAlgorithmIntoCredoKeyType = (algorithm: AlgorithmIdentifier): KeyType => {
  if (algorithm.isEqual(ecdsaWithSha256AndP256AlgorithmIdentifier)) {
    return KeyType.P256
  } else if (algorithm.isEqual(ecdsaWithSha256AndK256AlgorithmIdentifier)) {
    return KeyType.K256
  } else if (algorithm.isEqual(ed25519AlgorithmIdentifier)) {
    return KeyType.Ed25519
  } else if (algorithm.isEqual(x25519AlgorithmIdentifier)) {
    return KeyType.X25519
  } else if (algorithm.isEqual(ecdsaWithSHA256)) {
    throw new CredoWebCryptoError(`ecdsa with SHA256 was used. Please specify a curve in algorithm parameters`)
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
      return ecdsaWithSha256AndP256AlgorithmIdentifier
    case KeyType.P384:
      return ecdsaWithSha256AndP384AlgorithmIdentifier
    case KeyType.K256:
      return ecdsaWithSha256AndK256AlgorithmIdentifier
    default:
      throw new CredoWebCryptoError(`Unsupported key type: ${keyType}`)
  }
}
