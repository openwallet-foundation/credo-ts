/* eslint-disable @typescript-eslint/unbound-method */
import type { DependencyManager } from '@aries-framework/core'

import { OpenId4VcHolderApi } from '../src/issuance/OpenId4VciHolderApi'
import { OpenId4VcHolderModule } from '../src/issuance/OpenId4VciHolderModule'
import { OpenId4VcHolderService } from '../src/issuance/OpenId4VciHolderService'
import { OpenId4VpHolderService, PresentationExchangeService } from '../src/presentations'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcClientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const openId4VcClientModule = new OpenId4VcHolderModule()
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OpenId4VcHolderApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VpHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(PresentationExchangeService)
  })
})
