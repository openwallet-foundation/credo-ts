import type { DependencyManager } from '@credo-ts/core'
import type { OpenId4VcVerifierModuleConfigOptions } from '../OpenId4VcVerifierModuleConfig'

import { Router } from 'express'

import { OpenId4VcSiopVerifierService } from '../OpenId4VcSiopVerifierService'
import { OpenId4VcVerifierModule } from '../OpenId4VcVerifierModule'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierRepository } from '../repository'
import { OpenId4VcRelyingPartyEventHandler } from '../repository/OpenId4VcRelyingPartyEventEmitter'

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
        authorization: {
          endpointPath: '/hello',
        },
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

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcSiopVerifierService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcVerifierRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcRelyingPartyEventHandler)
  })
})
