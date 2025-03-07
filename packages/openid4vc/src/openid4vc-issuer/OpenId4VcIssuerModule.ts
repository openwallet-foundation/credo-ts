import type { Router } from 'express'
import type { FastifyInstance } from 'fastify'

import { setGlobalConfig } from '@animo-id/oauth2'
import { AgentConfig, type AgentContext, DependencyManager, InjectionSymbols, type Module } from '@credo-ts/core'
import createHttpError from 'http-errors'
import {
  OpenId4VcIssuerApi,
  OpenId4VcIssuerModuleConfig,
  type OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcIssuerService,
} from '.'
import { getAgentContextForActorId } from '../shared/router'
import { OpenId4VcIssuanceSessionRepository, OpenId4VcIssuerRepository } from './repository'

export abstract class OpenId4VcIssuerModule<RouterType extends Router | FastifyInstance> implements Module {
  public readonly api = OpenId4VcIssuerApi<RouterType>
  public readonly config: OpenId4VcIssuerModuleConfig<RouterType>

  constructor(options: OpenId4VcIssuerModuleConfigOptions<RouterType>) {
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
    dependencyManager.registerInstance(InjectionSymbols.OpenId4VcIssuerModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(OpenId4VcIssuerService)

    // Repository
    dependencyManager.registerSingleton(OpenId4VcIssuerRepository)
    dependencyManager.registerSingleton(OpenId4VcIssuanceSessionRepository)
  }
}

export async function buildOpenId4VcIssuanceRequestContext(issuerId: string, rootAgentContext: AgentContext) {
  if (!issuerId) {
    rootAgentContext.config.logger.debug('No issuerId provided for incoming oid4vci request, returning 404')
    throw createHttpError(404, 'Not Found')
  }

  let agentContext: AgentContext | undefined = undefined

  try {
    // FIXME: should we create combined openId actor record?
    agentContext = await getAgentContextForActorId(rootAgentContext, issuerId)
    const issuerApi = agentContext.dependencyManager.resolve(OpenId4VcIssuerApi)
    const issuer = await issuerApi.getIssuerByIssuerId(issuerId)

    return {
      agentContext,
      issuer,
    }
  } catch (error) {
    agentContext?.config.logger.error('Failed to correlate incoming oid4vci request to existing tenant and issuer', {
      error,
    })
    // If the opening failed
    await agentContext?.endSession()

    throw createHttpError(404, 'Not Found')
  }
}
