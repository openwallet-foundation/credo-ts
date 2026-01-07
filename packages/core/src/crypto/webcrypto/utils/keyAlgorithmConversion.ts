import { RSAPublicKey } from '@peculiar/asn1-rsa'
import { AsnParser, AsnSerializer } from '@peculiar/asn1-schema'
import { AlgorithmIdentifier, SubjectPublicKeyInfo } from '@peculiar/asn1-x509'
import { type KmsCreateKeyType, PublicJwk } from '../../../modules/kms'
import {
  ecPublicKeyWithK256AlgorithmIdentifier,
  ecPublicKeyWithP256AlgorithmIdentifier,
  ecPublicKeyWithP384AlgorithmIdentifier,
  ecPublicKeyWithP521AlgorithmIdentifier,
  ed25519AlgorithmIdentifier,
  rsaKeyAlgorithmIdentifier,
  x25519AlgorithmIdentifier,
} from '../algorithmIdentifiers'
import { CredoWebCryptoError } from '../CredoWebCryptoError'
import type { EcKeyGenParams, KeyGenAlgorithm, KeyImportParams, RsaHashedKeyGenParams } from '../types'

export const publicJwkToCryptoKeyAlgorithm = (key: PublicJwk): KeyImportParams => {
  const publicJwk = key.toJson()

  if (publicJwk.kty === 'EC') {
    if (publicJwk.crv === 'P-256' || publicJwk.crv === 'P-384' || publicJwk.crv === 'P-521') {
      return { name: 'ECDSA', namedCurve: publicJwk.crv }
    }

    if (publicJwk.crv === 'secp256k1') {
      return {
        name: 'ECDSA',
        namedCurve: 'K-256',
      }
    }
  } else if (publicJwk.kty === 'OKP') {
    if (publicJwk.crv === 'Ed25519') {
      return { name: 'Ed25519' }
    }
  }

  if (publicJwk.kty === 'RSA') {
    const signatureAlg = key.signatureAlgorithm
    switch (signatureAlg) {
      case 'RS256':
        return { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } }
      case 'RS384':
        return { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-384' } }
      case 'RS512':
        return { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-512' } }
      case 'PS256':
        return { name: 'RSA-PSS', hash: { name: 'SHA-256' } }
      case 'PS384':
        return { name: 'RSA-PSS', hash: { name: 'SHA-384' } }
      case 'PS512':
        return { name: 'RSA-PSS', hash: { name: 'SHA-512' } }
      default:
        throw new CredoWebCryptoError(`Unsupported RSA signature algorithm: ${signatureAlg}`)
    }
  }

  throw new CredoWebCryptoError(`Unsupported ${key.jwkTypeHumanDescription}`)
}

// TODO: support RSA
export const cryptoKeyAlgorithmToCreateKeyOptions = (algorithm: KeyGenAlgorithm) => {
  const algorithmName = algorithm.name.toUpperCase()
  switch (algorithmName) {
    case 'ED25519':
      return {
        kty: 'OKP',
        crv: 'Ed25519',
      } satisfies KmsCreateKeyType
    case 'X25519':
      return {
        kty: 'OKP',
        crv: 'X25519',
      } satisfies KmsCreateKeyType
    case 'ECDSA': {
      const crv = (algorithm as EcKeyGenParams).namedCurve.toUpperCase()
      switch (crv) {
        case 'P-256':
        case 'P-384':
        case 'P-521':
          return {
            kty: 'EC',
            crv,
          } satisfies KmsCreateKeyType
        case 'K-256':
          return {
            kty: 'EC',
            crv: 'secp256k1',
          } satisfies KmsCreateKeyType
        default:
          throw new CredoWebCryptoError(`Unsupported curve for ECDSA: ${(algorithm as EcKeyGenParams).namedCurve}`)
      }
    }
    case 'RSASSA-PKCS1-V1_5':
    case 'RSA-PSS': {
      const rsaParams = algorithm as RsaHashedKeyGenParams

      if (rsaParams.publicExponent) {
        throw new CredoWebCryptoError('Custom exponent not suported for RSA')
      }

      if (rsaParams.modulusLength !== 2048 && rsaParams.modulusLength !== 3072 && rsaParams.modulusLength !== 4096) {
        throw new CredoWebCryptoError(
          `Unsupported modulusLength '${rsaParams.modulusLength}' for RSA key. Expected one of 2048, 3072, 4096.`
        )
      }

      return {
        kty: 'RSA',
        modulusLength: rsaParams.modulusLength,
      } satisfies KmsCreateKeyType
    }
  }

  throw new CredoWebCryptoError(`Unsupported algorithm: ${algorithmName}`)
}

export const spkiToPublicJwk = (spki: SubjectPublicKeyInfo): PublicJwk => {
  if (spki.algorithm.isEqual(ecPublicKeyWithP256AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'EC',
      crv: 'P-256',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(ecPublicKeyWithP384AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'EC',
      crv: 'P-384',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(ecPublicKeyWithP521AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'EC',
      crv: 'P-521',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(ecPublicKeyWithK256AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'EC',
      crv: 'secp256k1',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(ed25519AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(x25519AlgorithmIdentifier)) {
    return PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: new Uint8Array(spki.subjectPublicKey),
    })
  }
  if (spki.algorithm.isEqual(rsaKeyAlgorithmIdentifier)) {
    // The RSA key is another ASN.1 structure inside the subjectPublicKey bit string
    // The first byte in the bit string is the number of unused bits (typically 0)
    const keyWithoutUnusedBits = new Uint8Array(spki.subjectPublicKey).slice(1)

    // Parse the RSA public key structure
    const rsaPublicKey = AsnParser.parse(keyWithoutUnusedBits, RSAPublicKey)

    return PublicJwk.fromPublicKey({
      kty: 'RSA',
      modulus: new Uint8Array(rsaPublicKey.modulus),
      exponent: new Uint8Array(rsaPublicKey.publicExponent),
    })
  }

  throw new CredoWebCryptoError(
    `Unsupported algorithm: ${spki.algorithm.algorithm}, with params: ${spki.algorithm.parameters ? 'yes' : 'no'}`
  )
}

export const publicJwkToSpki = (publicJwk: PublicJwk): SubjectPublicKeyInfo => {
  const publicKey = publicJwk.publicKey

  if (publicKey.kty === 'RSA') {
    const rsaPublicKey = new RSAPublicKey({
      modulus: new Uint8Array(publicKey.modulus).buffer,
      publicExponent: new Uint8Array(publicKey.exponent).buffer,
    })

    // 2. Encode the RSA public key to DER
    const rsaPublicKeyDer = AsnSerializer.serialize(rsaPublicKey)

    return new SubjectPublicKeyInfo({
      algorithm: rsaKeyAlgorithmIdentifier,
      subjectPublicKey: new Uint8Array([0, ...new Uint8Array(rsaPublicKeyDer)]).buffer,
    })
  }

  const crvToAlgorithm: Record<(typeof publicKey)['crv'], AlgorithmIdentifier> = {
    'P-256': ecPublicKeyWithP256AlgorithmIdentifier,
    'P-384': ecPublicKeyWithP384AlgorithmIdentifier,
    'P-521': ecPublicKeyWithP521AlgorithmIdentifier,
    secp256k1: ecPublicKeyWithK256AlgorithmIdentifier,
    Ed25519: ed25519AlgorithmIdentifier,
    X25519: x25519AlgorithmIdentifier,
  }

  return new SubjectPublicKeyInfo({
    algorithm: crvToAlgorithm[publicKey.crv],
    subjectPublicKey: new Uint8Array(publicKey.publicKey).buffer,
  })
}
