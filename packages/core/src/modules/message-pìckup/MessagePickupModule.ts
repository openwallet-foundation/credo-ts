import type { MessagePickupModuleConfigOptions } from './MessagePickupModuleConfig'
import type { DependencyManager, Module } from '../../plugins'

import { MessagePickupApi } from './MessagePickupApi'
import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'

export class MessagePickupModule implements Module {
  public readonly config: MessagePickupModuleConfig
  public readonly api = MessagePickupApi

  public constructor(config?: MessagePickupModuleConfigOptions) {
    this.config = new MessagePickupModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(MessagePickupApi)

    // Config
    dependencyManager.registerInstance(MessagePickupModuleConfig, this.config)

    // Protocols
    dependencyManager.registerSingleton(V1MessagePickupProtocol)
    dependencyManager.registerSingleton(V2MessagePickupProtocol)
  }
}
