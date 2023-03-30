import type { MessagePickupModuleConfigOptions } from './MessagePickupModuleConfig'
import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { ApiModule, DependencyManager } from '../../plugins'
import type { Optional } from '../../utils'
import type { Constructor } from '../../utils/mixins'

import { InjectionSymbols } from '../../constants'

import { MessagePickupApi } from './MessagePickupApi'
import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'

/**
 * Default protocols that will be registered if the `protocols` property is not configured.
 */
export type DefaultMessagePickupProtocols = [V1MessagePickupProtocol, V2MessagePickupProtocol]

// MessagePickupModuleOptions makes the protocols property optional from the config, as it will set it when not provided.
export type MessagePickupModuleOptions<MessagePickupProtocols extends MessagePickupProtocol[]> = Optional<
  MessagePickupModuleConfigOptions<MessagePickupProtocols>,
  'protocols'
>

export class MessagePickupModule<MessagePickupProtocols extends MessagePickupProtocol[] = DefaultMessagePickupProtocols>
  implements ApiModule
{
  public readonly config: MessagePickupModuleConfig<MessagePickupProtocols>

  // Infer Api type from the config
  public readonly api: Constructor<MessagePickupApi<MessagePickupProtocols>> = MessagePickupApi

  public constructor(config?: MessagePickupModuleOptions<MessagePickupProtocols>) {
    this.config = new MessagePickupModuleConfig({
      ...config,
      protocols: config?.protocols ?? [new V1MessagePickupProtocol(), new V2MessagePickupProtocol()],
    }) as MessagePickupModuleConfig<MessagePickupProtocols>
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(MessagePickupApi)

    // Config
    dependencyManager.registerInstance(MessagePickupModuleConfig, this.config)

    // Message repository
    if (this.config.messageRepository) {
      dependencyManager.registerInstance(InjectionSymbols.MessageRepository, this.config.messageRepository)
    }

    // Protocol needs to register feature registry items and handlers
    for (const protocol of this.config.protocols) {
      protocol.register(dependencyManager, featureRegistry)
    }
  }
}
