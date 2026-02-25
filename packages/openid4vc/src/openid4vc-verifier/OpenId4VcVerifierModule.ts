import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { NextFunction, Response } from 'express'
import { getAgentContextForActorId, getRequestContext, importExpress } from '../shared/router'
import { OpenId4VcVerifierApi } from './OpenId4VcVerifierApi'
import type { InternalOpenId4VcVerifierModuleConfigOptions } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VpVerifierService } from './OpenId4VpVerifierService'
import { OpenId4VcVerifierRepository } from './repository'
import type { OpenId4VcVerificationRequest } from './router'
import { configureAuthorizationEndpoint } from './router'
import { configureAuthorizationRequestEndpoint } from './router/authorizationRequestEndpoint'

/**
 * @public
 */
export class OpenId4VcVerifierModule implements Module {
  public readonly config: OpenId4VcVerifierModuleConfig

  public constructor(options: InternalOpenId4VcVerifierModuleConfigOptions | OpenId4VcVerifierModuleConfig) {
    this.config =
      options instanceof OpenId4VcVerifierModuleConfig ? options : new OpenId4VcVerifierModuleConfig(options)
  }

  /**
   * Registers the dependencies of the openid4vc verifier module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Since the OpenID4VC module is a nested module (a module consisting of three modules) we register the API
    // manually. In the future we may disallow resolving the sub-api, but for now it allows for a cleaner migration path
    dependencyManager.registerContextScoped(OpenId4VcVerifierApi)

    // Register config
    dependencyManager.registerInstance(OpenId4VcVerifierModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(OpenId4VpVerifierService)

    // Repository
    dependencyManager.registerSingleton(OpenId4VcVerifierRepository)
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    this.configureRouter(rootAgentContext)
  }

  /**
   * Registers the endpoints on the router passed to this module.
   */
  private configureRouter(rootAgentContext: AgentContext) {
    const { Router, json, urlencoded } = importExpress()

    // FIXME: it is currently not possible to initialize an agent
    // shut it down, and then start it again, as the
    // express router is configured with a specific `AgentContext` instance
    // and dependency manager. One option is to always create a new router
    // but then users cannot pass their own router implementation.
    // We need to find a proper way to fix this.

    const basePath = new URL(this.config.baseUrl).pathname

    // We use separate context router and endpoint router. Context router handles the linking of the request
    // to a specific agent context. Endpoint router only knows about a single context
    const verifierEndpointRouter = Router()
    const verifierContextRouter = Router()

    // parse application/x-www-form-urlencoded
    verifierContextRouter.use(urlencoded({ extended: false }))
    // parse application/json
    verifierContextRouter.use(json())

    verifierContextRouter.param('verifierId', this.getVerifierIdParamHandler(rootAgentContext))
    verifierContextRouter.use('/:verifierId', verifierEndpointRouter)

    // Configure endpoints
    configureAuthorizationEndpoint(verifierEndpointRouter, this.config)
    configureAuthorizationRequestEndpoint(verifierEndpointRouter, this.config)

    // First one will be called for all requests (when next is called)
    verifierContextRouter.use(async (req: OpenId4VcVerificationRequest, _res: unknown, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()
      next()
    })

    // This one will be called for all errors that are thrown
    verifierContextRouter.use(
      async (_error: unknown, req: OpenId4VcVerificationRequest, res: Response, next: NextFunction) => {
        const { agentContext } = getRequestContext(req)

        if (!res.headersSent) {
          agentContext.config.logger.warn(
            'Error was thrown but openid4vci endpoint did not send a response. Sending generic server_error.'
          )

          res.status(500).json({
            error: 'server_error',
            error_description: 'An unexpected error occurred on the server.',
          })
        }

        await agentContext.endSession()
        next()
      }
    )

    this.config.app.use(basePath, verifierContextRouter)
  }

  private getVerifierIdParamHandler =
    (rootAgentContext: AgentContext) =>
    async (req: OpenId4VcVerificationRequest, res: Response, next: NextFunction, verifierId: string) => {
      if (!verifierId) {
        rootAgentContext.config.logger.debug(
          'No verifierId provided for incoming authorization response, returning 404'
        )
        return res.status(404).send('Not found')
      }

      let agentContext: AgentContext | undefined

      try {
        agentContext = await getAgentContextForActorId(rootAgentContext, verifierId)
        const verifierApi = agentContext.dependencyManager.resolve(OpenId4VcVerifierApi)
        const verifier = await verifierApi.getVerifierByVerifierId(verifierId)

        req.requestContext = {
          agentContext,
          verifier,
        }
      } catch (error) {
        agentContext?.config.logger.error(
          'Failed to correlate incoming openid request to existing tenant and verifier',
          {
            error,
          }
        )
        // If the opening failed
        await agentContext?.endSession()
        return res.status(404).send('Not found')
      }

      next()
    }
}
