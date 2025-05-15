import { CredoError } from '../../../../error'
import type { VerificationMethod } from '../verificationMethod'
import { getPublicJwkFromMultikey, isMultikey } from '../verificationMethod'
import { getPublicJwkFromJsonWebKey2020, isJsonWebKey2020 } from '../verificationMethod/JsonWebKey2020'

import { Constructor } from '../../../../utils/mixins'
import { PublicJwk } from '../../../kms'
import { SupportedPublicJwkClass } from '../../../kms/jwk/PublicJwk'
import { keyDidEd25519 } from './ed25519'
import { keyDidJsonWebKey } from './keyDidJsonWebKey'
import { keyDidSecp256k1 } from './secp256k1'
import { keyDidX25519 } from './x25519'

export interface KeyDidMapping<
  PublicJwkType extends InstanceType<SupportedPublicJwkClass> = InstanceType<SupportedPublicJwkClass>,
> {
  PublicJwkTypes: Array<Constructor<PublicJwkType>>
  getVerificationMethods: (did: string, publicJwk: PublicJwk<PublicJwkType>) => VerificationMethod[]
  getPublicJwkFromVerificationMethod(verificationMethod: VerificationMethod): PublicJwk
  supportedVerificationMethodTypes: string[]
}

const supportedKeyDids = [keyDidEd25519, keyDidX25519, keyDidJsonWebKey, keyDidSecp256k1]

// TODO: at some point we should update all usages to Jwk / Multikey methods
// so we don't need key type specific verification methods anymore
export function getVerificationMethodsForPublicJwk(publicJwk: PublicJwk, did: string) {
  const { getVerificationMethods } = getKeyDidMappingByPublicJwk(publicJwk)

  return getVerificationMethods(did, publicJwk)
}

export function getSupportedVerificationMethodTypesForPublicJwk(
  publicJwk: PublicJwk | SupportedPublicJwkClass
): string[] {
  const { supportedVerificationMethodTypes } = getKeyDidMappingByPublicJwk(publicJwk)

  return supportedVerificationMethodTypes
}

export function getPublicJwkFromVerificationMethod(verificationMethod: VerificationMethod): PublicJwk {
  // This is a special verification method, as it supports basically all key types.
  if (isJsonWebKey2020(verificationMethod)) {
    return getPublicJwkFromJsonWebKey2020(verificationMethod)
  }

  if (isMultikey(verificationMethod)) {
    return getPublicJwkFromMultikey(verificationMethod)
  }

  const keyDid = supportedKeyDids.find((keyDid) =>
    keyDid.supportedVerificationMethodTypes.includes(verificationMethod.type)
  )
  if (!keyDid) {
    throw new CredoError(`Unsupported key did from verification method type '${verificationMethod.type}'`)
  }

  return keyDid.getPublicJwkFromVerificationMethod(verificationMethod)
}

function getKeyDidMappingByPublicJwk(jwk: PublicJwk | SupportedPublicJwkClass): KeyDidMapping {
  const jwkTypeClass = jwk instanceof PublicJwk ? jwk.JwkClass : jwk

  const keyDid = supportedKeyDids.find((supportedKeyDid) =>
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    supportedKeyDid.PublicJwkTypes.includes(jwkTypeClass as any)
  )

  if (!keyDid) {
    throw new CredoError(
      `Unsupported did mapping for jwk '${jwk instanceof PublicJwk ? jwk.jwkTypehumanDescription : jwk.name}'`
    )
  }

  return keyDid as KeyDidMapping
}
