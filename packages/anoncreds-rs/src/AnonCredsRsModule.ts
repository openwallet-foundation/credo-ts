import type { AnonCredsRsModuleConfigOptions } from './AnonCredsRsModuleConfig'
import type { DependencyManager, Module } from '@aries-framework/core'

import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '@aries-framework/anoncreds'

import { AnonCredsRsModuleConfig } from './AnonCredsRsModuleConfig'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from './services'

export class AnonCredsRsModule implements Module {
  public readonly config: AnonCredsRsModuleConfig

  public constructor(config: AnonCredsRsModuleConfigOptions) {
    this.config = new AnonCredsRsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(AnonCredsRsModuleConfig, this.config)

    // Register services
    dependencyManager.registerSingleton(AnonCredsHolderServiceSymbol, AnonCredsRsHolderService)
    dependencyManager.registerSingleton(AnonCredsIssuerServiceSymbol, AnonCredsRsIssuerService)
    dependencyManager.registerSingleton(AnonCredsVerifierServiceSymbol, AnonCredsRsVerifierService)
  }
}
