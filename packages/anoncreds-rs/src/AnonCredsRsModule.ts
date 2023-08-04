import type { AnonCredsRsModuleConfigOptions } from './AnonCredsRsModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '@aries-framework/anoncreds'
import { AgentConfig } from '@aries-framework/core'

import { AnonCredsRsModuleConfig } from './AnonCredsRsModuleConfig'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from './services'

export class AnonCredsRsModule implements Module {
  public readonly config: AnonCredsRsModuleConfig

  public constructor(config: AnonCredsRsModuleConfigOptions) {
    this.config = new AnonCredsRsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/anoncreds-rs' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    dependencyManager.registerInstance(AnonCredsRsModuleConfig, this.config)

    // Register services
    dependencyManager.registerSingleton(AnonCredsHolderServiceSymbol, AnonCredsRsHolderService)
    dependencyManager.registerSingleton(AnonCredsIssuerServiceSymbol, AnonCredsRsIssuerService)
    dependencyManager.registerSingleton(AnonCredsVerifierServiceSymbol, AnonCredsRsVerifierService)
  }
}
