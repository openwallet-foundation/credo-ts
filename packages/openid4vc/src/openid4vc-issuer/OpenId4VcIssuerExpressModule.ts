import { setGlobalConfig } from '@animo-id/oauth2'
import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import { AgentConfig } from '@credo-ts/core'
import type { NextFunction, Response, Router } from 'express'
import type { OpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuanceRequest } from './router'

import {
  CredoHttpResponse,
  CredoRouter,
  getAgentContextForActorId,
  getLogger,
  getRequestContext,
  importExpress,
  sendJsonResponse,
} from '../shared/router'

import { IncomingMessage } from 'http'
import { HttpError } from 'http-errors'
import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from './repository'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'
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

export class ExpressCredoRouter implements CredoRouter {
  constructor(public expressRouter: Router) {}
  post<HttpRequestType extends IncomingMessage, HttpResponseBodyType>(
    path: string,
    handler: (
      req: HttpRequestType
    ) => Promise<HttpResponseBodyType | CredoHttpResponse<HttpResponseBodyType> | undefined>
  ) {
    this.expressRouter.post(path, async (req, res, next) => {
      const result = await handler(req as unknown as HttpRequestType)
      if (result == null) {
        res.status(204).send()
      } else if (typeof result === 'object' && 'statusCode' in result) {
        sendJsonResponse(res, next, result, 'application/json', result.statusCode)
      } else {
        sendJsonResponse(res, next, result)
      }
    })
    return this
  }
}

/**
 * @public
 */
export class OpenId4VcIssuerExpressModule implements Module {
  public readonly api = OpenId4VcIssuerApi
  public readonly config: OpenId4VcIssuerModuleConfig<Router>

  public constructor(options: OpenId4VcIssuerModuleConfigOptions<Router>) {
    this.config = new OpenId4VcIssuerModuleConfig(options)
  }

  /**
   * Registers the dependencies of the openid4vc issuer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    const agentConfig = dependencyManager.resolve(AgentConfig)

    // Warn about experimental module
    agentConfig.logger.warn(
      "The '@credo-ts/openid4vc' Issuer module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
    )

    if (agentConfig.allowInsecureHttpUrls) {
      setGlobalConfig({
        allowInsecureUrls: true,
      })
    }
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
        if (!issuerId) {
          rootAgentContext.config.logger.debug('No issuerId provided for incoming oid4vci request, returning 404')
          _res.status(404).send('Not found')
        }

        let agentContext: AgentContext | undefined = undefined

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

          return _res.status(404).send('Not found')
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
    contextRouter.use(
      async (error: HttpError | unknown, req: OpenId4VcIssuanceRequest, res: Response, next: NextFunction) => {
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

        logError(error, req, res)
        await agentContext.endSession()
        next()
      }
    )
  }
}

export function logError(error: HttpError | unknown, request: OpenId4VcIssuanceRequest, _response: Response) {
  const logger = getLogger(request)
  if (error instanceof HttpError) {
    if (error.type === 'oauth2_error') {
      logger.warn(`[OID4VC] Sending oauth2 error response: ${JSON.stringify(error.message)}`, {
        error,
      })
    } else if ([401, 403].includes(error.statusCode)) {
      logger.warn(`[OID4VC] Sending authorization error response: ${JSON.stringify(error.message)}`, {
        error,
      })
    } else if (error.statusCode === 404) {
      logger.debug(`[OID4VC] Sending not found response: ${error.message}`, {
        error,
      })
    } else if (error.statusCode === 500) {
      logger.error('[OID4VC] Sending unknown server error response', {
        error,
      })
    }
  } else {
    logger.warn('[OID4VC] Sending error response', {
      error,
    })
  }
}
