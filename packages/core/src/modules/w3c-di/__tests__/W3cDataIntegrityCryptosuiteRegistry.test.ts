import { CredoError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { AkpPublicJwk, Ed25519PublicJwk, PublicJwk } from '../../kms'
import { EddsaJcs2022Cryptosuite } from '../cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import type { W3cDataIntegrityCryptosuiteInfo } from '../cryptosuites/types'
import { W3cDataIntegrityCryptosuiteRegistry } from '../W3cDataIntegrityCryptosuiteRegistry'

const cryptosuiteInfo = {
  cryptosuiteClass: EddsaJcs2022Cryptosuite,
  cryptosuite: 'eddsa-jcs-2022',
  supportedPublicJwkTypes: [Ed25519PublicJwk],
} satisfies W3cDataIntegrityCryptosuiteInfo

const mldsa44CryptosuiteInfo = {
  ...cryptosuiteInfo,
  cryptosuite: 'mldsa44-jcs-2024',
  supportedPublicJwkTypes: [AkpPublicJwk],
  supportedSignatureAlgorithms: ['ML-DSA-44'],
  autoSelect: false,
} satisfies W3cDataIntegrityCryptosuiteInfo

describe('W3cDataIntegrityCryptosuiteRegistry', () => {
  test('returns registered cryptosuite by name', () => {
    const registry = new W3cDataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(registry.getByCryptosuite('eddsa-jcs-2022')).toEqual(cryptosuiteInfo)
    expect(registry.supportedCryptosuites).toEqual(['eddsa-jcs-2022'])
  })

  test('returns registered cryptosuites by public jwk type', () => {
    const registry = new W3cDataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(registry.getAllByPublicJwkType(Ed25519PublicJwk)).toEqual([cryptosuiteInfo])
  })

  test('does not auto-select the explicit ML-DSA-44 cryptosuite or mismatch AKP variants', () => {
    const registry = new W3cDataIntegrityCryptosuiteRegistry([mldsa44CryptosuiteInfo])
    const mldsa44 = PublicJwk.fromUnknown({
      kty: 'AKP',
      alg: 'ML-DSA-44',
      pub: TypedArrayEncoder.toBase64Url(new Uint8Array(1312).fill(1)),
    })
    const mldsa65 = PublicJwk.fromUnknown({
      kty: 'AKP',
      alg: 'ML-DSA-65',
      pub: TypedArrayEncoder.toBase64Url(new Uint8Array(1952).fill(1)),
    })

    expect(registry.getAllByPublicJwkType(mldsa44)).toEqual([])
    expect(registry.getAllByPublicJwkType(mldsa65)).toEqual([])
    expect(registry.getAllByPublicJwkType(AkpPublicJwk)).toEqual([])
    expect(registry.getByCryptosuite('mldsa44-jcs-2024')).toEqual(mldsa44CryptosuiteInfo)
  })

  test('throws for unknown cryptosuite', () => {
    const registry = new W3cDataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(() => registry.getByCryptosuite('unknown-cryptosuite')).toThrow(CredoError)
  })
})
