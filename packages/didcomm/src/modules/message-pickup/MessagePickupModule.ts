import type { MessagePickupModuleConfigOptions } from './MessagePickupModuleConfig'
import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { QueuePackedMessageForPickupEvent } from '../../Events'
import type { Subject } from 'rxjs'

import {
  type ApiModule,
  type DependencyManager,
  type AgentContext,
  type Constructor,
  type Optional,
  EventEmitter,
  InjectionSymbols,
} from '@credo-ts/core'
import { takeUntil } from 'rxjs'

import { AgentEventTypes } from '../../Events'
import { FeatureRegistry } from '../../FeatureRegistry'
import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'

import { MessagePickupApi } from './MessagePickupApi'
import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'
import { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'
import { MessagePickupSessionService } from './services'

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
   * Registers the dependencies of the message pickup module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(MessagePickupModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MessagePickupSessionService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Protocol needs to register feature registry items and handlers
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(MessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(FeatureRegistry)

    for (const protocol of this.config.protocols) {
      protocol.register(messageHandlerRegistry, featureRegistry)
    }

    const messagePickupSessionService = agentContext.dependencyManager.resolve(MessagePickupSessionService)

    messagePickupSessionService.start(agentContext)

    // Keep track of all queued messages and
    const stop$ = agentContext.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter
      .observable<QueuePackedMessageForPickupEvent>(AgentEventTypes.QueuePackedMessageForPickup)
      .pipe(takeUntil(stop$))
      .subscribe({
        next: async (e) => {
          const { connectionId, recipientDids, payload } = e.payload
          await this.config.messagePickupRepository.addMessage({ connectionId, recipientDids, payload })
        },
      })
  }
}
