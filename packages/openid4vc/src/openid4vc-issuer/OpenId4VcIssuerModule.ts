import type { OpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import type { IssuanceRequest } from './router/requestContext'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { getRequestContext } from '../shared/router'

import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'
import { configureAccessTokenEndpoint, configureCredentialEndpoint, configureIssuerMetadataEndpoint } from './router'
import { importExpress } from './router/express'
import { getAgentContextForIssuerId } from './router/requestContext'

/**
 * @public
 */
export class OpenId4VcIssuerModule implements Module {
  public readonly api = OpenId4VcIssuerApi
  public readonly config: OpenId4VcIssuerModuleConfig

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.config = new OpenId4VcIssuerModuleConfig(options)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/openid4vc' Issuer module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages. Multi-Tenancy is not supported."
      )

    // Register config
    dependencyManager.registerInstance(OpenId4VcIssuerModuleConfig, this.config)

    // Api
    dependencyManager.registerContextScoped(OpenId4VcIssuerApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcIssuerService)

    // Repository
    dependencyManager.registerSingleton(OpenId4VcIssuerRepository)
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    this.configureRouter(rootAgentContext)
  }

  /**
   * Registers the endpoints on the router passed to this module.
   */
  private configureRouter(rootAgentContext: AgentContext) {
    const { Router, json, urlencoded } = importExpress()

    // We use separate context router and endpoint router. Context router handles the linking of the request
    // to a specific agent context. Endpoint router only knows about a single context
    const endpointRouter = Router()
    const contextRouter = this.config.router

    // parse application/x-www-form-urlencoded
    contextRouter.use(urlencoded({ extended: false }))
    // parse application/json
    contextRouter.use(json())

    contextRouter.param('issuerId', async (req: IssuanceRequest, _res, next, issuerId: string) => {
      if (!issuerId) {
        _res.status(404).send('Not found')
      }

      let agentContext: AgentContext | undefined = undefined

      try {
        agentContext = await getAgentContextForIssuerId(rootAgentContext, issuerId)
        const issuerApi = agentContext.dependencyManager.resolve(OpenId4VcIssuerApi)
        const issuer = await issuerApi.getByIssuerId(issuerId)

        req.requestContext = {
          agentContext,
          issuer,
        }
      } catch (error) {
        agentContext?.config.logger.error(
          'Failed to correlate incoming oid4vci request to existing tenant and issuer',
          {
            error,
          }
        )
        // If the opening failed
        await agentContext?.endSession()
        return _res.status(404).send('Not found')
      }

      next()
    })

    contextRouter.use('/:issuerId', endpointRouter)

    // Configure endpoints
    configureIssuerMetadataEndpoint(endpointRouter)
    configureAccessTokenEndpoint(endpointRouter, this.config.accessTokenEndpoint)
    configureCredentialEndpoint(endpointRouter, this.config.credentialEndpoint)

    // FIXME: Will this be called when an error occurs / 404 is returned earlier on?
    contextRouter.use(async (req: IssuanceRequest, _res, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()
      next()
    })
  }
}
