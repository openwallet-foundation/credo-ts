import type { DependencyManager } from '@aries-framework/core'

import { OpenId4VcClientApi } from '../OpenId4VcClientApi'
import { OpenId4VcClientModule } from '../OpenId4VcClientModule'
import { OpenId4VcClientService } from '../OpenId4VcClientService'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

describe('OpenId4VcClientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const openId4VcClientModule = new OpenId4VcClientModule()
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OpenId4VcClientApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcClientService)
  })
})
