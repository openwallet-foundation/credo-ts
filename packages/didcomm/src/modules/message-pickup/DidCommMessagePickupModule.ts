import type { AgentContext, ApiModule, Constructor, DependencyManager, Optional } from '@credo-ts/core'
import type { MessagePickupModuleConfigOptions } from './DidCommMessagePickupModuleConfig'
import type { DidCommMessagePickupProtocol } from './protocol/DidCommMessagePickupProtocol'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'

import { DidCommMessagePickupApi } from './DidCommMessagePickupApi'
import { DidCommMessagePickupModuleConfig } from './DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol } from './protocol'
import { DidCommMessagePickupSessionService } from './services'

/**
 * Default protocols that will be registered if the `protocols` property is not configured.
 */
export type DefaultMessagePickupProtocols = [DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol]

// MessagePickupModuleOptions makes the protocols property optional from the config, as it will set it when not provided.
export type MessagePickupModuleOptions<MessagePickupProtocols extends DidCommMessagePickupProtocol[]> = Optional<
  MessagePickupModuleConfigOptions<MessagePickupProtocols>,
  'protocols'
>

export class DidCommMessagePickupModule<
  MessagePickupProtocols extends DidCommMessagePickupProtocol[] = DefaultMessagePickupProtocols,
> implements ApiModule
{
  public readonly config: DidCommMessagePickupModuleConfig<MessagePickupProtocols>

  // Infer Api type from the config
  public readonly api: Constructor<DidCommMessagePickupApi<MessagePickupProtocols>> = DidCommMessagePickupApi

  public constructor(config?: MessagePickupModuleOptions<MessagePickupProtocols>) {
    this.config = new DidCommMessagePickupModuleConfig({
      ...config,
      protocols: config?.protocols ?? [new DidCommMessagePickupV1Protocol(), new DidCommMessagePickupV2Protocol()],
    }) as DidCommMessagePickupModuleConfig<MessagePickupProtocols>
  }

  /**
   * Registers the dependencies of the message pickup answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommMessagePickupModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommMessagePickupSessionService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    // Protocol needs to register feature registry items and handlers
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    for (const protocol of this.config.protocols) {
      protocol.register(messageHandlerRegistry, featureRegistry)
    }
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // We only support initialization of message pickup for the root agent
    if (!agentContext.isRootAgentContext) return

    // FIXME: this does not take into account multi-tenant agents, need to think how to separate based on context
    const messagePickupSessionService = agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)
    messagePickupSessionService.start(agentContext)
  }
}
