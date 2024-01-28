import type { DependencyManager } from '@aries-framework/core'

import { OpenId4VcHolderApi } from '../OpenId4VcHolderApi'
import { OpenId4VcHolderModule } from '../OpenId4VcHolderModule'
import { OpenId4VciHolderService } from '../OpenId4VciHolderService'
import { OpenId4VcSiopHolderService } from '../OpenId4vcSiopHolderService'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcHolderModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const openId4VcClientModule = new OpenId4VcHolderModule()
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OpenId4VcHolderApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VciHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcSiopHolderService)
  })
})
