/* eslint-disable @typescript-eslint/unbound-method */
import type { DependencyManager } from '@aries-framework/core'

import { Presentation } from '@aries-framework/openid4vc-verifier'

import { OpenId4VcHolderApi } from '../src/OpenId4VcHolderApi'
import { OpenId4VcHolderModule } from '../src/OpenId4VcHolderModule'
import { OpenId4VciHolderService } from '../src/issuance/OpenId4VciHolderService'

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

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VciHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(Presentation.OpenId4VpHolderService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(Presentation.PresentationExchangeService)
  })
})
