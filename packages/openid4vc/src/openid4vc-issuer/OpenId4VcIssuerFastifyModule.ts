import type { AgentContext, Module } from '@credo-ts/core'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { HttpError } from 'http-errors'
import { FastifyRouterFactory, type HasRequestContext, getRequestContext } from '../shared/router'
import type { IssuerIdParam } from './IssuerIdParam'
import { logError } from './LogError'
import { OpenId4VcIssuerModule, buildOpenId4VcIssuanceRequestContext } from './OpenId4VcIssuerModule'

import type { OpenId4VcIssuerModuleConfig, OpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuerRecord } from './repository'
import { configureIssuerMetadataEndpoint, configureCredentialEndpoint } from './router'
declare module 'fastify' {
  interface FastifyRequest extends HasRequestContext<{ issuer: OpenId4VcIssuerRecord }> {}
}
/**
 * @public
 */
export class OpenId4VcIssuerFastifyModule extends OpenId4VcIssuerModule<FastifyInstance> implements Module {
  constructor(options: OpenId4VcIssuerModuleConfigOptions<FastifyInstance>) {
    super(options, new FastifyRouterFactory())
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    const rootFastify = this.config.router as FastifyInstance
    rootFastify.register(openId4VcIssuerPlugin, { rootAgentContext, config: this.config, prefix: '/:issuerId' })
  }
}

async function openId4VcIssuerPlugin(
  fastify: FastifyInstance,
  { rootAgentContext, config }: { rootAgentContext: AgentContext; config: OpenId4VcIssuerModuleConfig<FastifyInstance> }
) {
  fastify
    .decorateRequest('requestContext')
    .addHook<{ Params: IssuerIdParam }>('preHandler', async (request, reply) => {
      try {
        request.requestContext = await buildOpenId4VcIssuanceRequestContext(request.params.issuerId, rootAgentContext)
      } catch (error) {
        return reply.status(error.statusCode).send(error.message)
      }
    })
    .setErrorHandler(async (error, request: FastifyRequest, reply: FastifyReply) => {
      const { agentContext } = getRequestContext(request)

      const statusCode = error instanceof HttpError ? error.statusCode : 500
      reply.status(statusCode)

      if (error instanceof HttpError && error.headers != null) {
        for (const [name, value] of Object.entries(error.headers)) {
          reply.header(name, value)
        }
      }

      if (error instanceof HttpError && error.errorResponse != null) {
        reply.send(error.errorResponse)
      } else if (statusCode === 500) {
        reply.send({
          error: error.message ?? 'server_error',
          error_description: 'An unexpected error occurred on the server.',
        })
      } else {
        reply.send()
      }

      logError(error, getRequestContext(request))
      await agentContext.endSession()
    })
    .addHook('onResponse', async (request) => {
      const { agentContext } = getRequestContext(request)
      await agentContext.endSession()
    })

  // Register endpoints
  // configureIssuerMetadataEndpoint(fastify)
  // configureJwksEndpoint(fastify, this.config)
  // configureNonceEndpoint(fastify, this.config)
  // configureOAuthAuthorizationServerMetadataEndpoint(fastify)
  // configureCredentialOfferEndpoint(fastify, this.config)
  // configureAccessTokenEndpoint(fastify, this.config)
  // configureAuthorizationChallengeEndpoint(fastify, this.config)
  configureCredentialEndpoint(fastify, config)
}
