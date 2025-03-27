import { DependencyManager, InjectionSymbols } from '@credo-ts/core'

import { Router } from 'express'

import { getAgentContext } from '../../../../core/tests'
import { ExpressRouterFactory } from '../../shared/router'
import { OpenId4VcIssuerExpressModule } from '../OpenId4VcIssuerExpressModule'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'
import { OpenId4VcIssuerRepository } from '../repository/OpenId4VcIssuerRepository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

const agentContext = getAgentContext()

describe('OpenId4VcIssuerModule', () => {
  test('registers dependencies on the dependency manager', async () => {
    const options = {
      baseUrl: 'http://localhost:3000',
      credentialRequestToCredentialMapper: () => {
        throw new Error('Not implemented')
      },
      router: Router(),
    } as const
    const openId4VcClientModule = new OpenId4VcIssuerExpressModule(options)
    openId4VcClientModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(
      InjectionSymbols.OpenId4VcIssuerModuleConfig,
      new OpenId4VcIssuerModuleConfig(options, new ExpressRouterFactory())
    )

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcIssuerService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcIssuanceSessionRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(OpenId4VcIssuerRepository)

    await openId4VcClientModule.initialize(agentContext)

    expect(openId4VcClientModule.config.router).toBeDefined()
  })
})
