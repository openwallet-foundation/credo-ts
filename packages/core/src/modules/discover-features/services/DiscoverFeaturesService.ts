import type { AgentContext } from '../../../agent'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { DiscoverFeaturesModuleConfig } from '../DiscoverFeaturesModuleConfig'
import type {
  CreateDisclosureOptions,
  CreateQueryOptions,
  DiscoverFeaturesProtocolMsgReturnType,
} from '../DiscoverFeaturesServiceOptions'
import type { FeatureRegistry } from '../FeatureRegistry'

export abstract class DiscoverFeaturesService {
  protected featureRegistry: FeatureRegistry
  protected eventEmitter: EventEmitter
  protected dispatcher: Dispatcher
  protected logger: Logger
  protected discoverFeaturesModuleConfig: DiscoverFeaturesModuleConfig

  public constructor(
    featureRegistry: FeatureRegistry,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    logger: Logger,
    discoverFeaturesModuleConfig: DiscoverFeaturesModuleConfig
  ) {
    this.featureRegistry = featureRegistry
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.logger = logger
    this.discoverFeaturesModuleConfig = discoverFeaturesModuleConfig
  }

  abstract readonly version: string

  abstract createQuery(
    agentContext: AgentContext,
    options: CreateQueryOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<AgentMessage>>
  abstract processQuery(
    messageContext: InboundMessageContext<AgentMessage>
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<AgentMessage> | void>

  // methods for offer
  abstract createDisclosure(
    agentContext: AgentContext,
    options: CreateDisclosureOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<AgentMessage>>
  abstract processDisclosure(messageContext: InboundMessageContext<AgentMessage>): Promise<void>
}
