import type { DependencyManager } from '../../../plugins'
import { Ed25519PublicJwk, P256PublicJwk, P384PublicJwk } from '../../kms'
import { EcdsaJcs2019Cryptosuite } from '../cryptosuites/ecdsa-jcs-2019/EcdsaJcs2019Cryptosuite'
import { EddsaJcs2022Cryptosuite } from '../cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import { W3cDataIntegrityCryptosuiteToken } from '../cryptosuites/types'
import { W3cDataIntegrityApi } from '../W3cDataIntegrityApi'
import { W3cDataIntegrityCryptosuiteRegistry } from '../W3cDataIntegrityCryptosuiteRegistry'
import { W3cDataIntegrityModule } from '../W3cDataIntegrityModule'
import { W3cDataIntegrityProofService } from '../W3cDataIntegrityProofService'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('W3cDataIntegrityModule wiring', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('registers W3cDataIntegrityProofService and W3cDataIntegrityCryptosuiteRegistry', () => {
    const module = new W3cDataIntegrityModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cDataIntegrityProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cDataIntegrityCryptosuiteRegistry)
  })

  test('registers eddsa-jcs-2022 for Ed25519 keys and ecdsa-jcs-2019 for P-256 and P-384 keys', () => {
    const module = new W3cDataIntegrityModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cDataIntegrityCryptosuiteToken, {
      cryptosuiteClass: EddsaJcs2022Cryptosuite,
      cryptosuite: 'eddsa-jcs-2022',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    })
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cDataIntegrityCryptosuiteToken, {
      cryptosuiteClass: EcdsaJcs2019Cryptosuite,
      cryptosuite: 'ecdsa-jcs-2019',
      supportedPublicJwkTypes: [P256PublicJwk, P384PublicJwk],
    })
  })

  test('exposes W3cDataIntegrityApi', () => {
    const module = new W3cDataIntegrityModule()

    expect(module.api).toBe(W3cDataIntegrityApi)
  })
})
