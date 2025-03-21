import type { DependencyManager } from '@credo-ts/core'
import type { OpenId4VcVerifierModuleConfigOptions } from '../OpenId4VcVerifierModuleConfig'

import { Router } from 'express'

import { OpenId4VcVerifierModule } from '../OpenId4VcVerifierModule'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'
import { OpenId4VpVerifierService } from '../OpenId4VpVerifierService'
import { OpenId4VcVerifierRepository } from '../repository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('OpenId4VcVerifierModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const options = {
      baseUrl: 'http://localhost:3000',
      endpoints: {
        authorization: '/hello',
      },
      router: Router(),
    } satisfies OpenId4VcVerifierModuleConfigOptions
    const openId4VcClientModule = new OpenId4VcVerifierModule(options)
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(
      OpenId4VcVerifierModuleConfig,
      new OpenId4VcVerifierModuleConfig(options)
    )

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VpVerifierService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcVerifierRepository)
  })
})
