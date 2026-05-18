import { CredoError } from '../../../error'
import { Ed25519PublicJwk } from '../../kms'
import { EddsaJcs2022Cryptosuite } from '../cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import type { DataIntegrityCryptosuiteInfo } from '../cryptosuites/types'
import { DataIntegrityCryptosuiteRegistry } from '../DataIntegrityCryptosuiteRegistry'

const cryptosuiteInfo = {
  cryptosuiteClass: EddsaJcs2022Cryptosuite,
  cryptosuite: 'eddsa-jcs-2022',
  supportedPublicJwkTypes: [Ed25519PublicJwk],
} satisfies DataIntegrityCryptosuiteInfo

describe('DataIntegrityCryptosuiteRegistry', () => {
  test('returns registered cryptosuite by name', () => {
    const registry = new DataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(registry.getByCryptosuite('eddsa-jcs-2022')).toEqual(cryptosuiteInfo)
    expect(registry.supportedCryptosuites).toEqual(['eddsa-jcs-2022'])
  })

  test('returns registered cryptosuites by public jwk type', () => {
    const registry = new DataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(registry.getAllByPublicJwkType(Ed25519PublicJwk)).toEqual([cryptosuiteInfo])
  })

  test('throws for unknown cryptosuite', () => {
    const registry = new DataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(() => registry.getByCryptosuite('unknown-cryptosuite')).toThrow(CredoError)
  })
})
