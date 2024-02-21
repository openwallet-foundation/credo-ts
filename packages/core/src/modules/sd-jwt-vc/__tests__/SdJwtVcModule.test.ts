import type { DependencyManager } from '@credo-ts/core'

import { SdJwtVcModule } from '../SdJwtVcModule'
import { SdJwtVcService } from '../SdJwtVcService'
import { SdJwtVcRepository } from '../repository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
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
