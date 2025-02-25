import type { Key } from '../../../../crypto/Key'
import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto/KeyType'
import { getJwkFromJson } from '../../../../crypto/jose/jwk'
import { CredoError } from '../../../../error'
import { VERIFICATION_METHOD_TYPE_MULTIKEY, getKeyFromMultikey, isMultikey } from '../verificationMethod'
import { VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020, isJsonWebKey2020 } from '../verificationMethod/JsonWebKey2020'

import { keyDidBls12381g1 } from './bls12381g1'
import { keyDidBls12381g1g2 } from './bls12381g1g2'
import { keyDidBls12381g2 } from './bls12381g2'
import { keyDidEd25519 } from './ed25519'
import { keyDidJsonWebKey } from './keyDidJsonWebKey'
import { keyDidSecp256k1 } from './secp256k1'
import { keyDidX25519 } from './x25519'

export interface KeyDidMapping {
  getVerificationMethods: (did: string, key: Key) => VerificationMethod[]
  getKeyFromVerificationMethod(verificationMethod: VerificationMethod): Key
  supportedVerificationMethodTypes: string[]
}

// TODO: Maybe we should make this dynamically?
const keyDidMapping: Record<KeyType, KeyDidMapping> = {
  [KeyType.Ed25519]: keyDidEd25519,
  [KeyType.X25519]: keyDidX25519,
  [KeyType.Bls12381g1]: keyDidBls12381g1,
  [KeyType.Bls12381g2]: keyDidBls12381g2,
  [KeyType.Bls12381g1g2]: keyDidBls12381g1g2,
  [KeyType.P256]: keyDidJsonWebKey,
  [KeyType.P384]: keyDidJsonWebKey,
  [KeyType.P521]: keyDidJsonWebKey,
  [KeyType.K256]: keyDidSecp256k1,
}

/**
 * Dynamically creates a mapping from verification method key type to the key Did interface
 * for all key types.
 *
 * {
 *    "Ed25519VerificationKey2018": KeyDidMapping
 * }
 */
const verificationMethodKeyDidMapping = Object.values(KeyType).reduce<Record<string, KeyDidMapping>>(
  (mapping, keyType) => {
    const supported = keyDidMapping[keyType].supportedVerificationMethodTypes.reduce<Record<string, KeyDidMapping>>(
      (accumulator, vMethodKeyType) => ({
        // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
        ...accumulator,
        [vMethodKeyType]: keyDidMapping[keyType],
      }),
      {}
    )

    return {
      // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
      ...mapping,
      ...supported,
    }
  },
  {}
)

export function getKeyDidMappingByKeyType(keyType: KeyType) {
  const keyDid = keyDidMapping[keyType]

  if (!keyDid) {
    throw new CredoError(`Unsupported key did from key type '${keyType}'`)
  }

  return keyDid
}

export function getKeyFromVerificationMethod(verificationMethod: VerificationMethod): Key {
  // This is a special verification method, as it supports basically all key types.
  if (isJsonWebKey2020(verificationMethod)) {
    // TODO: move this validation to another place
    if (!verificationMethod.publicKeyJwk) {
      throw new CredoError(
        `Missing publicKeyJwk on verification method with type ${VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020}`
      )
    }

    return getJwkFromJson(verificationMethod.publicKeyJwk).key
  }

  if (isMultikey(verificationMethod)) {
    if (!verificationMethod.publicKeyMultibase) {
      throw new CredoError(
        `Missing publicKeyMultibase on verification method with type ${VERIFICATION_METHOD_TYPE_MULTIKEY}`
      )
    }

    return getKeyFromMultikey(verificationMethod)
  }

  const keyDid = verificationMethodKeyDidMapping[verificationMethod.type]
  if (!keyDid) {
    throw new CredoError(`Unsupported key did from verification method type '${verificationMethod.type}'`)
  }

  return keyDid.getKeyFromVerificationMethod(verificationMethod)
}

export function getSupportedVerificationMethodTypesFromKeyType(keyType: KeyType) {
  const keyDid = keyDidMapping[keyType]

  if (!keyDid) {
    throw new CredoError(`Unsupported key did from key type '${keyType}'`)
  }

  return keyDid.supportedVerificationMethodTypes
}
