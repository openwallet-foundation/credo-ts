import type { EventEmitter, Logger } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommInboundMessageContext } from '../../../models'
import type { DidCommDiscoverFeaturesModuleConfig } from '../DidCommDiscoverFeaturesModuleConfig'
import type {
  CreateDisclosureOptions,
  CreateQueryOptions,
  DiscoverFeaturesProtocolMsgReturnType,
} from '../DidCommDiscoverFeaturesServiceOptions'

export abstract class DidCommDiscoverFeaturesService {
  protected featureRegistry: DidCommFeatureRegistry
  protected eventEmitter: EventEmitter
  protected logger: Logger
  protected discoverFeaturesModuleConfig: DidCommDiscoverFeaturesModuleConfig

  public constructor(
    featureRegistry: DidCommFeatureRegistry,
    eventEmitter: EventEmitter,
    logger: Logger,
    discoverFeaturesModuleConfig: DidCommDiscoverFeaturesModuleConfig
  ) {
    this.featureRegistry = featureRegistry
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.discoverFeaturesModuleConfig = discoverFeaturesModuleConfig
  }

  public abstract readonly version: string

  public abstract createQuery(
    options: CreateQueryOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommMessage>>
  public abstract processQuery(
    messageContext: DidCommInboundMessageContext<DidCommMessage>
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommMessage> | undefined>

  public abstract createDisclosure(
    options: CreateDisclosureOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommMessage>>
  public abstract processDisclosure(messageContext: DidCommInboundMessageContext<DidCommMessage>): Promise<void>
}
