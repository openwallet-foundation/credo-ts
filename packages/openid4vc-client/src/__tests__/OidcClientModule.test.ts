import type { DependencyManager } from '@aries-framework/core'

import { W3cCredentialService } from '@aries-framework/core'

import { OidcClientApi } from '../OidcClientApi'
import { OidcClientModule } from '../OidcClientModule'
import { OidcClientService } from '../OidcClientService'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

describe('OidcClientModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const oidcClientModule = new OidcClientModule()
    oidcClientModule.register(dependencyManager)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OidcClientApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OidcClientService)
  })
})
