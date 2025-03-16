import type { AgentContext, Module } from '@credo-ts/core'
import type { NextFunction, Response, Router } from 'express'
import type { OpenId4VcIssuanceRequest } from './router'

import type { OpenId4VcIssuerModuleConfigOptions } from '@credo-ts/openid4vc'
import { HttpError } from 'http-errors'
import { ExpressRouterFactory, getRequestContext, importExpress } from '../shared/router'
import { ExpressCredoRouter } from '../shared/router/ExpressCredoRouter'
import { logError } from './LogError'
import { OpenId4VcIssuerModule, buildOpenId4VcIssuanceRequestContext } from './OpenId4VcIssuerModule'
import {
  configureAccessTokenEndpoint,
  configureAuthorizationChallengeEndpoint,
  configureCredentialEndpoint,
  configureCredentialOfferEndpoint,
  configureIssuerMetadataEndpoint,
  configureJwksEndpoint,
  configureNonceEndpoint,
  configureOAuthAuthorizationServerMetadataEndpoint,
} from './router'

/**
 * @public
 */
export class OpenId4VcIssuerExpressModule extends OpenId4VcIssuerModule<Router> implements Module {
  constructor(options: OpenId4VcIssuerModuleConfigOptions<Router>) {
    super(options, new ExpressRouterFactory())
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    this.configureRouter(rootAgentContext)
  }

  /**
   * Registers the endpoints on the router passed to this module.
   */
  private configureRouter(rootAgentContext: AgentContext) {
    const { Router, json, urlencoded } = importExpress()

    // TODO: it is currently not possible to initialize an agent
    // shut it down, and then start it again, as the
    // express router is configured with a specific `AgentContext` instance
    // and dependency manager. One option is to always create a new router
    // but then users cannot pass their own router implementation.
    // We need to find a proper way to fix this.

    // We use separate context router and endpoint router. Context router handles the linking of the request
    // to a specific agent context. Endpoint router only knows about a single context
    const endpointRouter = new ExpressCredoRouter(Router())
    const contextRouter = this.config.router as Router

    // parse application/x-www-form-urlencoded
    contextRouter.use(urlencoded({ extended: false }))
    // parse application/json
    contextRouter.use(json())

    contextRouter.param(
      'issuerId',
      async (req: OpenId4VcIssuanceRequest, _res: Response, next: NextFunction, issuerId: string) => {
        try {
          req.requestContext = await buildOpenId4VcIssuanceRequestContext(issuerId, rootAgentContext)
        } catch (error) {
          return _res.status(error.statusCode).send(error.message)
        }
        next()
      }
    )

    contextRouter.use('/:issuerId', endpointRouter.expressRouter)

    // Configure endpoints
    configureIssuerMetadataEndpoint(endpointRouter.expressRouter)
    configureJwksEndpoint(endpointRouter.expressRouter, this.config)
    configureNonceEndpoint(endpointRouter.expressRouter, this.config)
    configureOAuthAuthorizationServerMetadataEndpoint(endpointRouter.expressRouter)
    configureCredentialOfferEndpoint(endpointRouter.expressRouter, this.config)
    configureAccessTokenEndpoint(endpointRouter.expressRouter, this.config)
    configureAuthorizationChallengeEndpoint(endpointRouter.expressRouter, this.config)
    configureCredentialEndpoint(endpointRouter, this.config)

    // First one will be called for all requests (when next is called)
    contextRouter.use(async (req: OpenId4VcIssuanceRequest, _res: unknown, next: NextFunction) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()
      next()
    })

    // This one will be called for all errors that are thrown
    endpointRouter.expressRouter.use(
      async (error: HttpError | Error | string, req: OpenId4VcIssuanceRequest, res: Response, next: NextFunction) => {
        const { agentContext } = getRequestContext(req)

        const statusCode = error instanceof HttpError ? error.statusCode : 500

        res.status(statusCode)

        if (error instanceof HttpError && error.headers != null) {
          for (const [name, value] of Object.entries(error.headers)) {
            res.setHeader(name, value)
          }
        }

        if (error instanceof HttpError && error.errorResponse != null) {
          res.json(error.errorResponse)
        } else if (error instanceof Error && statusCode === 500) {
          res.json({
            error: error.message ?? 'server_error',
            error_description: 'An unexpected error occurred on the server.',
          })
        } else if (error instanceof String) {
          res.json({ error: error ?? 'server_error', error_description: 'An unexpected error occurred on the server.' })
        } else {
          res.send()
        }

        logError(error, getRequestContext(req))
        await agentContext.endSession()
        next()
      }
    )
  }
}
