import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { AgentConfig } from '@credo-ts/core'
import { setGlobalConfig } from '@openid4vc/oauth2'
import { OpenId4VcApi } from './OpenId4VcApi'
import {
  type OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcModuleConfig,
  type OpenId4VcModuleConfigOptions,
  type OpenId4VcVerifierModuleConfigOptions,
} from './OpenId4VcModuleConfig'
import { OpenId4VcHolderModule } from './openid4vc-holder'
import { OpenId4VcIssuerModule } from './openid4vc-issuer'
import { OpenId4VcVerifierModule } from './openid4vc-verifier'

/**
 * @public
 */
export class OpenId4VcModule<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> implements Module
{
  public readonly api: typeof OpenId4VcApi<IssuerConfig, VerifierConfig> = OpenId4VcApi
  public readonly config: OpenId4VcModuleConfig<IssuerConfig, VerifierConfig>

  public readonly issuer?: IssuerConfig extends OpenId4VcIssuerModuleConfigOptions
    ? OpenId4VcIssuerModule
    : IssuerConfig extends null
      ? OpenId4VcIssuerModule | undefined
      : undefined
  public readonly verifier?: VerifierConfig extends OpenId4VcVerifierModuleConfigOptions
    ? OpenId4VcVerifierModule
    : VerifierConfig extends null
      ? OpenId4VcVerifierModule | undefined
      : undefined
  public readonly holder: OpenId4VcHolderModule

  public constructor(options?: OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>) {
    this.config = new OpenId4VcModuleConfig(options)

    this.issuer = (this.config.issuer ? new OpenId4VcIssuerModule(this.config.issuer) : undefined) as this['issuer']
    this.holder = new OpenId4VcHolderModule()
    this.verifier = (
      this.config.verifier ? new OpenId4VcVerifierModule(this.config.verifier) : undefined
    ) as this['verifier']
  }

  /**
   * Registers the dependencies of the openid4vc issuer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    const agentConfig = dependencyManager.resolve(AgentConfig)

    // Warn about experimental module
    agentConfig.logger.warn(
      "The '@credo-ts/openid4vc' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @credo-ts packages."
    )

    if (agentConfig.allowInsecureHttpUrls) {
      setGlobalConfig({
        allowInsecureUrls: true,
      })
    }

    // Register config
    dependencyManager.registerInstance(OpenId4VcModuleConfig, this.config)

    this.issuer?.register(dependencyManager)
    this.holder?.register(dependencyManager)
    this.verifier?.register(dependencyManager)
  }

  public async initialize(rootAgentContext: AgentContext): Promise<void> {
    this.issuer?.initialize(rootAgentContext)
    this.verifier?.initialize(rootAgentContext)
  }
}
