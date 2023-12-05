/* eslint-disable @typescript-eslint/unbound-method */
import type { DependencyManager } from '@aries-framework/core'

import { OpenId4VcIssuerApi } from '../OpenId4VcIssuerApi'
import { OpenId4VcIssuerModule } from '../OpenId4VcIssuerModule'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcIssuerModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const issuerMetadata = {
      credentialIssuer: 'https://example.com',
      credentialEndpoint: 'https://example.com/credentials',
      tokenEndpoint: 'https://example.com/token',
      credentialsSupported: [],
    }
    const openId4VcClientModule = new OpenId4VcIssuerModule({
      issuerMetadata,
    })
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(
      OpenId4VcIssuerModuleConfig,
      new OpenId4VcIssuerModuleConfig({ issuerMetadata })
    )

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(OpenId4VcIssuerApi)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcIssuerService)
  })
})
