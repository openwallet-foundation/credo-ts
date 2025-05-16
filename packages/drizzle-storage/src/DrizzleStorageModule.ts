import type { DependencyManager, Module } from '@credo-ts/core'
import type { DrizzleStorageModuleConfigOptions } from './DrizzleStorageModuleConfig'

import { CredoError, InjectionSymbols } from '@credo-ts/core'

import { DrizzleStorageModuleConfig } from './DrizzleStorageModuleConfig'
import { DrizzleStorageService } from './storage'

export class DrizzleStorageModule implements Module {
  public readonly config: DrizzleStorageModuleConfig

  public constructor(config: DrizzleStorageModuleConfigOptions) {
    this.config = new DrizzleStorageModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(DrizzleStorageModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError(
        'Unable to register DrizzleStorageService. There is an instance of StorageService already registered'
      )
    }
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, DrizzleStorageService)
  }
}
