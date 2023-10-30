import type { DependencyManager } from '@aries-framework/core'

import { SdJwtApi } from '../SdJwtApi'
import { SdJwtModule } from '../SdJwtModule'
import { SdJwtService } from '../SdJwtService'
import { SdJwtRepository } from '../repository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('SdJwtModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const sdJwtModule = new SdJwtModule()
    sdJwtModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(SdJwtApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SdJwtService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SdJwtRepository)
  })
})
