import type { DependencyManager } from '../../../plugins'
import { DataIntegrityApi } from '../DataIntegrityApi'
import { DataIntegrityCryptosuiteRegistry } from '../DataIntegrityCryptosuiteRegistry'
import { DataIntegrityModule } from '../DataIntegrityModule'
import { DataIntegrityProofService } from '../DataIntegrityProofService'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('DataIntegrityModule wiring', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('registers DataIntegrityProofService and DataIntegrityCryptosuiteRegistry', () => {
    const module = new DataIntegrityModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DataIntegrityProofService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DataIntegrityCryptosuiteRegistry)
  })

  test('exposes DataIntegrityApi', () => {
    const module = new DataIntegrityModule()

    expect(module.api).toBe(DataIntegrityApi)
  })
})
