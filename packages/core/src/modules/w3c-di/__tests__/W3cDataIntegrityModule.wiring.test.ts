import type { DependencyManager } from '../../../plugins'
import { AkpPublicJwk } from '../../kms'
import { Mldsa44Jcs2024Cryptosuite } from '../cryptosuites/mldsa44-jcs-2024/Mldsa44Jcs2024Cryptosuite'
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

  test('registers ML-DSA-44 without making it eligible for automatic selection', () => {
    const module = new W3cDataIntegrityModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cDataIntegrityCryptosuiteToken, {
      cryptosuiteClass: Mldsa44Jcs2024Cryptosuite,
      cryptosuite: 'mldsa44-jcs-2024',
      supportedPublicJwkTypes: [AkpPublicJwk],
      supportedSignatureAlgorithms: ['ML-DSA-44'],
      autoSelect: false,
    })
  })

  test('exposes W3cDataIntegrityApi', () => {
    const module = new W3cDataIntegrityModule()

    expect(module.api).toBe(W3cDataIntegrityApi)
  })
})
