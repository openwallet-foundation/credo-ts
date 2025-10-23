import { type AgentContext, type DependencyManager, joinUriParts, type Module } from '@credo-ts/core'
import type { NextFunction, Response } from 'express'
import { getAgentContextForActorId, getRequestContext, importExpress } from '../shared/router'
import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import type { InternalOpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from './repository'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'
import type { OpenId4VcIssuanceRequest } from './router'
import {
  configureAccessTokenEndpoint,
  configureAuthorizationChallengeEndpoint,
  configureCredentialEndpoint,
  configureCredentialOfferEndpoint,
  configureDeferredCredentialEndpoint,
  configureIssuerMetadataEndpoint,
  configureJwksEndpoint,
  configureNonceEndpoint,
  configureOAuthAuthorizationServerMetadataEndpoint,
} from './router'

/**
 * @public
 */
export class OpenId4VcIssuerModule implements Module {
  public readonly config: OpenId4VcIssuerModuleConfig

  public constructor(options: InternalOpenId4VcIssuerModuleConfigOptions | OpenId4VcIssuerModuleConfig) {
    this.config = options instanceof OpenId4VcIssuerModuleConfig ? options : new OpenId4VcIssuerModuleConfig(options)
  }

  /**
   * Registers the dependencies of the openid4vc issuer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Since the OpenID4VC module is a nested module (a module consisting of three modules) we register the API
    // manually. In the future we may disallow resolving the sub-api, but for now it allows for a cleaner migration path
    dependencyManager.registerContextScoped(OpenId4VcIssuerApi)

    // Register config
    dependencyManager.registerInstance(OpenId4VcIssuerModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(OpenId4VcIssuerService)

    // Repository
    dependencyManager.registerSingleton(OpenId4VcIssuerRepository)
    dependencyManager.registerSingleton(OpenId4VcIssuanceSessionRepository)
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    this.configureRouter(rootAgentContext)
  }

  /**
   * Registers the endpoints on the router passed to this module.
   */
  private configureRouter(rootAgentContext: AgentContext) {
    // TODO: it is currently not possible to initialize an agent
    // shut it down, and then start it again, as the
    // express router is configured with a specific `AgentContext` instance
    // and dependency manager. One option is to always create a new router
    // but then users cannot pass their own router implementation.
    // We need to find a proper way to fix this.
    this.registerWellKnownRoutes(rootAgentContext)
    this.registerIssuerRoutes(rootAgentContext)
  }

  private getIssuerIdParamHandler =
    (rootAgentContext: AgentContext) =>
    async (req: OpenId4VcIssuanceRequest, res: Response, next: NextFunction, issuerId: string) => {
      if (!issuerId) {
        rootAgentContext.config.logger.debug('No issuerId provided for incoming oid4vci request, returning 404')
        return res.status(404).send('Not found')
      }

      let agentContext: AgentContext | undefined

      try {
        // FIXME: should we create combined openId actor record?
        agentContext = await getAgentContextForActorId(rootAgentContext, issuerId)
        const issuerApi = agentContext.dependencyManager.resolve(OpenId4VcIssuerApi)
        const issuer = await issuerApi.getIssuerByIssuerId(issuerId)

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

        return res.status(404).send('Not found')
      }

      next()
    }

  private registerWellKnownRoutes(rootAgentContext: AgentContext) {
    const issuerIdParamHandler = this.getIssuerIdParamHandler(rootAgentContext)
    const { Router } = importExpress()
    const wellKnownEndpointsRouter = Router()

    const basePath = new URL(this.config.baseUrl).pathname
    const issuerPath = joinUriParts(basePath, [':issuerId'])

    // The files need to be hosted at the root .well-known directory
    const openidCredentialIssuerPath = joinUriParts('/.well-known/openid-credential-issuer', [issuerPath])
    const oauthAuthorizationServerPath = joinUriParts('/.well-known/oauth-authorization-server', [issuerPath])

    wellKnownEndpointsRouter.param('issuerId', issuerIdParamHandler)

    configureIssuerMetadataEndpoint(wellKnownEndpointsRouter, openidCredentialIssuerPath)
    configureOAuthAuthorizationServerMetadataEndpoint(wellKnownEndpointsRouter, oauthAuthorizationServerPath)

    wellKnownEndpointsRouter.use(async (req: OpenId4VcIssuanceRequest, _res: unknown, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()

      next()
    })

    // This one will be called for all errors that are thrown
    wellKnownEndpointsRouter.use(
      async (_error: unknown, req: OpenId4VcIssuanceRequest, res: Response, next: NextFunction) => {
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

    // We only want these routes to be handle by the router, so we register each path separately
    // here, so it's also possible for the app to register other `.well-known` endpoints.
    this.config.app.get(openidCredentialIssuerPath, wellKnownEndpointsRouter)
    this.config.app.get(oauthAuthorizationServerPath, wellKnownEndpointsRouter)
  }

  private registerIssuerRoutes(rootAgentContext: AgentContext) {
    const { Router, json, urlencoded } = importExpress()

    const issuerContextRouter = Router()
    const issuerEndpointsRouter = Router()
    const issuerIdParamHandler = this.getIssuerIdParamHandler(rootAgentContext)

    const basePath = new URL(this.config.baseUrl).pathname

    // parse application/x-www-form-urlencoded
    issuerContextRouter.use(urlencoded({ extended: false }))
    // parse application/json
    issuerContextRouter.use(json())

    // Register the issuer endpoints under /:issuerId
    issuerContextRouter.param('issuerId', issuerIdParamHandler)
    issuerContextRouter.use('/:issuerId', issuerEndpointsRouter)

    // NOTE: these are here for backwards compat, at some point we should remove them for the root well-known counterpart
    configureIssuerMetadataEndpoint(issuerEndpointsRouter, '/.well-known/openid-credential-issuer')
    configureOAuthAuthorizationServerMetadataEndpoint(issuerEndpointsRouter, '/.well-known/oauth-authorization-server')

    configureJwksEndpoint(issuerEndpointsRouter, this.config)
    configureNonceEndpoint(issuerEndpointsRouter, this.config)
    configureCredentialOfferEndpoint(issuerEndpointsRouter, this.config)
    configureAccessTokenEndpoint(issuerEndpointsRouter, this.config)
    configureAuthorizationChallengeEndpoint(issuerEndpointsRouter, this.config)
    configureCredentialEndpoint(issuerEndpointsRouter, this.config)
    configureDeferredCredentialEndpoint(issuerEndpointsRouter, this.config)

    // First one will be called for all requests (when next is called)
    issuerContextRouter.use(async (req: OpenId4VcIssuanceRequest, _res: unknown, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()

      next()
    })

    // This one will be called for all errors that are thrown
    issuerContextRouter.use(
      async (_error: unknown, req: OpenId4VcIssuanceRequest, res: Response, next: NextFunction) => {
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

    // Register the issuer context router under /<basePath>
    this.config.app.use(basePath, issuerContextRouter)
  }
}
