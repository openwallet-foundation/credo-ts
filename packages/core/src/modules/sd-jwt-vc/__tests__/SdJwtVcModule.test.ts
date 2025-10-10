import type { DependencyManager } from '@credo-ts/core'

import { SdJwtVcModule } from '../SdJwtVcModule'
import { SdJwtVcService } from '../SdJwtVcService'
import { SdJwtVcRepository } from '../repository'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('SdJwtVcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const sdJwtVcModule = new SdJwtVcModule()
    sdJwtVcModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SdJwtVcService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SdJwtVcRepository)
  })
})
