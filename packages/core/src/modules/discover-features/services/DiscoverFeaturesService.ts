import type { EventEmitter } from '../../../agent/EventEmitter'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DidCommV1Message, DidCommV2Message } from '../../../didcomm'
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
  protected logger: Logger
  protected discoverFeaturesModuleConfig: DiscoverFeaturesModuleConfig

  public constructor(
    featureRegistry: FeatureRegistry,
    eventEmitter: EventEmitter,
    logger: Logger,
    discoverFeaturesModuleConfig: DiscoverFeaturesModuleConfig
  ) {
    this.featureRegistry = featureRegistry
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.discoverFeaturesModuleConfig = discoverFeaturesModuleConfig
  }

  public abstract readonly version: string

  public abstract createQuery(
    options: CreateQueryOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message | DidCommV2Message>>
  public abstract processQuery(
    messageContext: InboundMessageContext<DidCommV1Message | DidCommV2Message>
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message | DidCommV2Message> | void>

  public abstract createDisclosure(
    options: CreateDisclosureOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommV1Message | DidCommV2Message>>
  public abstract processDisclosure(
    messageContext: InboundMessageContext<DidCommV1Message | DidCommV2Message>
  ): Promise<void>
}
