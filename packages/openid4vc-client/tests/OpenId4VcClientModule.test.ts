/* eslint-disable @typescript-eslint/unbound-method */
import type { DependencyManager } from '@aries-framework/core'

import { OpenId4VcClientApi } from '../src/OpenId4VcClientApi'
import { OpenId4VcClientModule } from '../src/OpenId4VcClientModule'
import { OpenId4VcClientService } from '../src/OpenId4VcClientService'
import { OpenId4VpClientService, PresentationExchangeService } from '../src/presentations'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcClientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const openId4VcClientModule = new OpenId4VcClientModule()
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OpenId4VcClientApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcClientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VpClientService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(PresentationExchangeService)
  })
})
