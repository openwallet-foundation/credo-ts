import type { DependencyManager } from '../../../plugins'
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

  test('exposes W3cDataIntegrityApi', () => {
    const module = new W3cDataIntegrityModule()

    expect(module.api).toBe(W3cDataIntegrityApi)
  })
})
