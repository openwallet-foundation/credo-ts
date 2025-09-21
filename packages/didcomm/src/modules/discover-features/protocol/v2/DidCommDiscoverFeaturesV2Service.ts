import type { DidCommInboundMessageContext } from '../../../../models'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../../DidCommDiscoverFeaturesEvents'
import type {
  CreateDisclosureOptions,
  CreateQueryOptions,
  DiscoverFeaturesProtocolMsgReturnType,
} from '../../DidCommDiscoverFeaturesServiceOptions'

import { EventEmitter, InjectionSymbols, Logger, inject, injectable } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import { DidCommDiscoverFeaturesEventTypes } from '../../DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesModuleConfig } from '../../DidCommDiscoverFeaturesModuleConfig'
import { DidCommDiscoverFeaturesService } from '../../services'

import { DidCommFeaturesDisclosuresMessageHandler, DidCommFeaturesQueriesMessageHandler } from './handlers'
import { DidCommFeaturesDisclosuresMessage, DidCommFeaturesQueriesMessage } from './messages'

@injectable()
export class DidCommDiscoverFeaturesV2Service extends DidCommDiscoverFeaturesService {
  public constructor(
    featureRegistry: DidCommFeatureRegistry,
    eventEmitter: EventEmitter,
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    @inject(InjectionSymbols.Logger) logger: Logger,
    discoverFeaturesModuleConfig: DidCommDiscoverFeaturesModuleConfig
  ) {
    super(featureRegistry, eventEmitter, logger, discoverFeaturesModuleConfig)
    this.registerMessageHandlers(messageHandlerRegistry)
  }

  /**
   * The version of the discover features protocol this service supports
   */
  public readonly version = 'v2'

  private registerMessageHandlers(messageHandlerRegistry: DidCommMessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DidCommFeaturesDisclosuresMessageHandler(this))
    messageHandlerRegistry.registerMessageHandler(new DidCommFeaturesQueriesMessageHandler(this))
  }

  public async createQuery(
    options: CreateQueryOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommFeaturesQueriesMessage>> {
    const queryMessage = new DidCommFeaturesQueriesMessage({ queries: options.queries })

    return { message: queryMessage }
  }

  public async processQuery(
    messageContext: DidCommInboundMessageContext<DidCommFeaturesQueriesMessage>
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommFeaturesDisclosuresMessage> | undefined> {
    const { queries, threadId } = messageContext.message

    const connection = messageContext.assertReadyConnection()

    this.eventEmitter.emit<DidCommDiscoverFeaturesQueryReceivedEvent>(messageContext.agentContext, {
      type: DidCommDiscoverFeaturesEventTypes.QueryReceived,
      payload: {
        message: messageContext.message,
        connection,
        queries,
        protocolVersion: this.version,
        threadId,
      },
    })

    // Process query and send responde automatically if configured to do so, otherwise
    // just send the event and let controller decide
    if (this.discoverFeaturesModuleConfig.autoAcceptQueries) {
      return await this.createDisclosure({
        threadId,
        disclosureQueries: queries,
      })
    }
  }

  public async createDisclosure(
    options: CreateDisclosureOptions
  ): Promise<DiscoverFeaturesProtocolMsgReturnType<DidCommFeaturesDisclosuresMessage>> {
    const matches = this.featureRegistry.query(...options.disclosureQueries)

    const discloseMessage = new DidCommFeaturesDisclosuresMessage({
      threadId: options.threadId,
      features: matches,
    })

    return { message: discloseMessage }
  }

  public async processDisclosure(messageContext: DidCommInboundMessageContext<DidCommFeaturesDisclosuresMessage>): Promise<void> {
    const { disclosures, threadId } = messageContext.message

    const connection = messageContext.assertReadyConnection()

    this.eventEmitter.emit<DidCommDiscoverFeaturesDisclosureReceivedEvent>(messageContext.agentContext, {
      type: DidCommDiscoverFeaturesEventTypes.DisclosureReceived,
      payload: {
        message: messageContext.message,
        connection,
        disclosures,
        protocolVersion: this.version,
        threadId,
      },
    })
  }
}
