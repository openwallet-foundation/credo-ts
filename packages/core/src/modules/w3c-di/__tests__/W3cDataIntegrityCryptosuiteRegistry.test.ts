import { CredoError } from '../../../error'
import { Ed25519PublicJwk } from '../../kms'
import { EddsaJcs2022Cryptosuite } from '../cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import type { W3cDataIntegrityCryptosuiteInfo } from '../cryptosuites/types'
import { W3cDataIntegrityCryptosuiteRegistry } from '../W3cDataIntegrityCryptosuiteRegistry'

const cryptosuiteInfo = {
  cryptosuiteClass: EddsaJcs2022Cryptosuite,
  cryptosuite: 'eddsa-jcs-2022',
  supportedPublicJwkTypes: [Ed25519PublicJwk],
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

  test('throws for unknown cryptosuite', () => {
    const registry = new W3cDataIntegrityCryptosuiteRegistry([cryptosuiteInfo])

    expect(() => registry.getByCryptosuite('unknown-cryptosuite')).toThrow(CredoError)
  })
})
