import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DidCommV1Message } from '../../../didcomm'
import type { Logger } from '../../../logger'
import type { DiscoverFeaturesModuleConfig } from '../DiscoverFeaturesModuleConfig'
import type {
  CreateDisclosureOptions,
  CreateQueryOptions,
  DiscoverFeaturesProtocolMsgReturnType,
} from '../DiscoverFeaturesServiceOptions'

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

  abstract createQuery(options: CreateQueryOptions): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message>>
  abstract processQuery(
    messageContext: InboundMessageContext<DidCommV1Message>
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message> | void>

  abstract createDisclosure(
    options: CreateDisclosureOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message>>
  abstract processDisclosure(messageContext: InboundMessageContext<DidCommV1Message>): Promise<void>
}
