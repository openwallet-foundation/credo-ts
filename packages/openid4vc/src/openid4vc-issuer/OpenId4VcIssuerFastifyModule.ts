import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type {OpenId4VcIssuerModuleConfigOptions} from './OpenId4VcIssuerModuleConfig'

import { setGlobalConfig } from '@animo-id/oauth2'
import { AgentConfig } from '@credo-ts/core'

import {getAgentContextForActorId, getRequestContext, HasRequestContext, importFastify} from '../shared/router'

import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import {OpenId4VcIssuanceSessionRepository, type OpenId4VcIssuerRecord} from './repository'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'
import {
    configureAccessTokenEndpoint,
    configureAuthorizationChallengeEndpoint,
    configureCredentialEndpoint,
    configureCredentialOfferEndpoint,
    configureIssuerMetadataEndpoint,
    configureJwksEndpoint,
    configureNonceEndpoint,
    configureOAuthAuthorizationServerMetadataEndpoint, type OpenId4VcIssuanceRequest,
} from './router'
import {OpenId4VcIssuancePostRequest} from "./router/requestContext";



export interface IssuerIdParams {
  issuerId: string
}

declare module 'fastify' {
    interface FastifyRequest extends HasRequestContext<{ issuer: OpenId4VcIssuerRecord }> {}
}
/**
 * @public
 */
export class OpenId4VcIssuerModule implements Module {
    public readonly api = OpenId4VcIssuerApi
    public readonly config: OpenId4VcIssuerModuleConfig<FastifyInstance>

    public constructor(options: OpenId4VcIssuerModuleConfigOptions<FastifyInstance>) {
        this.config = new OpenId4VcIssuerModuleConfig(options)
    }

    public register(dependencyManager: DependencyManager) {
        const agentConfig = dependencyManager.resolve(AgentConfig)

        agentConfig.logger.warn(
            "The '@credo-ts/openid4vc' Issuer module is experimental and may have breaking changes. Use strict versions for all @credo-ts packages."
        )

        if (agentConfig.allowInsecureHttpUrls) {
            setGlobalConfig({
                allowInsecureUrls: true,
            })
        }

        dependencyManager.registerInstance(OpenId4VcIssuerModuleConfig, this.config)
        dependencyManager.registerSingleton(OpenId4VcIssuerService)
        dependencyManager.registerSingleton(OpenId4VcIssuerRepository)
        dependencyManager.registerSingleton(OpenId4VcIssuanceSessionRepository)
    }

    public async initialize(rootAgentContext: AgentContext): Promise<void> {
        this.configureRouter(rootAgentContext)
    }

    private configureRouter(rootAgentContext: AgentContext) {
        const fastify = this.config.router as FastifyInstance

        fastify.decorateRequest('requestContext', null);
        fastify.addHook<{Params: IssuerIdParams}>('preHandler', async (request, reply) => {
            try {
                const issuerId = request.params.issuerId as string
                if (!issuerId) {
                    rootAgentContext.config.logger.debug('No issuerId provided for incoming request, returning 404')
                    return reply.status(404).send('Not found')
                }

                const agentContext = await getAgentContextForActorId(rootAgentContext, issuerId)
                const issuerApi = agentContext.dependencyManager.resolve(OpenId4VcIssuerApi)
                const issuer = await issuerApi.getIssuerByIssuerId(issuerId)

                request.requestContext = { agentContext, issuer }
            } catch (error) {
                rootAgentContext.config.logger.error('Failed to correlate request to existing tenant and issuer', { error })
                return reply.status(404).send('Not found')
            }
        })

        // Register endpoints
        // configureIssuerMetadataEndpoint(fastify)
        // configureJwksEndpoint(fastify, this.config)
        // configureNonceEndpoint(fastify, this.config)
        // configureOAuthAuthorizationServerMetadataEndpoint(fastify)
        // configureCredentialOfferEndpoint(fastify, this.config)
        // configureAccessTokenEndpoint(fastify, this.config)
        // configureAuthorizationChallengeEndpoint(fastify, this.config)
        configureCredentialEndpoint(fastify, this.config)

        // Global cleanup hook
        fastify.addHook('onResponse', async (request) => {
            const { agentContext } = getRequestContext(request)
            await agentContext.endSession()
        })
    }
}
