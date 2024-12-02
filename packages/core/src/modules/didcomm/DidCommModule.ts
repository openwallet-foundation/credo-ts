import type { DidCommModuleConfigOptions } from './DidCommModuleConfig'
import type { AgentContext } from '../../agent'
import type { DependencyManager, Module } from '../../plugins'

import { DidCommApi } from './DidCommApi'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { DidCommMessageRepository } from './repository'

export class DidCommModule implements Module {
  public readonly config: DidCommModuleConfig
  public readonly api = DidCommApi

  public constructor(config?: DidCommModuleConfigOptions) {
    this.config = new DidCommModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MessageHandlerRegistry)
    dependencyManager.registerSingleton(MessageSender)
    dependencyManager.registerSingleton(MessageReceiver)
    dependencyManager.registerSingleton(TransportService)
    dependencyManager.registerSingleton(Dispatcher)
    dependencyManager.registerSingleton(EnvelopeService)
    dependencyManager.registerSingleton(FeatureRegistry)

    // Repositories
    dependencyManager.registerSingleton(DidCommMessageRepository)

    // Features
    // TODO: Constraints?
  }

  public async shutdown(agentContext: AgentContext) {
    const didcommApi = agentContext.dependencyManager.resolve(DidCommApi)
    await didcommApi.shutdown()
  }
}
