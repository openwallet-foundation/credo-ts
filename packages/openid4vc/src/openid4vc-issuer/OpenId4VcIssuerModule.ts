import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { OpenId4VcIssuerModuleConfigOptions } from './OpenId4VcIssuerModuleConfig'
import type { RouterFactory, SupportedRouterTypes,  } from '../shared/router'

import { AgentConfig, InjectionSymbols } from '@credo-ts/core'
import { setGlobalConfig } from '@openid4vc/oauth2'
import createHttpError from 'http-errors'

import { getAgentContextForActorId } from '../shared/router'
import { OpenId4VcIssuerApi } from './OpenId4VcIssuerApi'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from './repository'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'


export abstract class OpenId4VcIssuerModule<RouterType extends SupportedRouterTypes> implements Module {
  public readonly api = OpenId4VcIssuerApi<RouterType>
  public readonly config: OpenId4VcIssuerModuleConfig<RouterType>

  constructor(options: OpenId4VcIssuerModuleConfigOptions<RouterType>, routerFactory: RouterFactory<RouterType>) {
    this.config = new OpenId4VcIssuerModuleConfig(options, routerFactory)
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
