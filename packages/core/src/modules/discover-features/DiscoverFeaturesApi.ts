import type { AgentMessageProcessedEvent } from '../../agent/Events'
import type { ParsedMessageType } from '../../utils/messageType'
import type { DiscloseFeaturesOptions, QueryFeaturesOptions, ServiceMap } from './DiscoverFeaturesModuleOptions'
import type { DiscoverFeaturesService } from './services'

import { firstValueFrom, of, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, map, takeUntil, timeout } from 'rxjs/operators'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { inject, injectable } from '../../plugins'
import { canHandleMessageType, parseMessageType } from '../../utils/messageType'
import { ConnectionService } from '../connections/services'

import { V1DiscloseMessage, V1DiscoverFeaturesService, V2DiscoverFeaturesService } from './protocol'

export interface DiscoverFeaturesApi<DFSs extends DiscoverFeaturesService[]> {
  isProtocolSupported(connectionId: string, message: { type: ParsedMessageType }): Promise<boolean>
  queryFeatures(options: QueryFeaturesOptions<DFSs>): Promise<void>
  discloseFeatures(options: DiscloseFeaturesOptions<DFSs>): Promise<void>
}
@injectable()
export class DiscoverFeaturesApi<
  DFSs extends DiscoverFeaturesService[] = [V1DiscoverFeaturesService, V2DiscoverFeaturesService]
> implements DiscoverFeaturesApi<DFSs>
{
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private stop$: Subject<boolean>
  private agentContext: AgentContext
  private serviceMap: ServiceMap<DFSs>

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    v1Service: V1DiscoverFeaturesService,
    v2Service: V2DiscoverFeaturesService,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    agentContext: AgentContext
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.stop$ = stop$
    this.agentContext = agentContext

    // Dynamically build service map. This will be extracted once services are registered dynamically
    this.serviceMap = [v1Service, v2Service].reduce(
      (serviceMap, service) => ({
        ...serviceMap,
        [service.version]: service,
      }),
      {}
    ) as ServiceMap<DFSs>
  }

  public getService<PVT extends DiscoverFeaturesService['version']>(protocolVersion: PVT): DiscoverFeaturesService {
    if (!this.serviceMap[protocolVersion]) {
      throw new AriesFrameworkError(`No discover features service registered for protocol version ${protocolVersion}`)
    }

    return this.serviceMap[protocolVersion]
  }

  /**
   * Perform a simple query to a connection to verify if it supports a particular protocol based in
   * an input message. Query is performed using RFC 0031 protocol.
   *
   * TODO: Update to use specific events from this module. Make timeout configurable
   *
   * @param connectionId target connection id
   * @param message object containing a {ParsedMessageType} to search for
   * @returns boolean indicating whether the message is supported or not
   */
  public async isProtocolSupported(connectionId: string, message: { type: ParsedMessageType }) {
    const { protocolUri } = message.type

    // Listen for response to our feature query
    const replaySubject = new ReplaySubject(1)
    this.eventEmitter
      .observable<AgentMessageProcessedEvent>(AgentEventTypes.AgentMessageProcessed)
      .pipe(
        // Stop when the agent shuts down
        takeUntil(this.stop$),
        // filter by connection id and query disclose message type
        filter(
          (e) =>
            e.payload.connection?.id === connectionId &&
            canHandleMessageType(V1DiscloseMessage, parseMessageType(e.payload.message.type))
        ),
        // Return whether the protocol is supported
        map((e) => {
          const message = e.payload.message as V1DiscloseMessage
          return message.protocols.map((p) => p.protocolId).includes(protocolUri)
        }),
        // TODO: make configurable
        // If we don't have an answer in 7 seconds (no response, not supported, etc...) error
        timeout(7000),
        // We want to return false if an error occurred
        catchError(() => of(false))
      )
      .subscribe(replaySubject)

    await this.queryFeatures({
      connectionId,
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: protocolUri }],
      comment: 'Detect if protocol is supported',
    })

    const isProtocolSupported = await firstValueFrom(replaySubject)
    return isProtocolSupported
  }

  /**
   * Send feature queries to an existing connection for discovering supported features of any kind.
   *
   * Note: V1 protocol only supports a single query and is limited to protocols
   *
   * @param options feature queries to perform, protocol version and optional comment string (only used
   * in V1 protocol).
   */
  public async queryFeatures(options: QueryFeaturesOptions<DFSs>) {
    const service = this.getService(options.protocolVersion)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    const { message: queryMessage } = await service.createQuery(this.agentContext, {
      queries: options.queries,
      comment: options.comment,
    })

    const outbound = createOutboundMessage(connection, queryMessage)
    await this.messageSender.sendMessage(this.agentContext, outbound)
  }

  /**
   * Disclose features to a connection, either proactively or as a response to a query.
   *
   * Features are disclosed based on queries that will be performed to Agent's Feature Registry,
   * meaning that they should be registered prior to disclosure. When sending disclosure as response,
   * these queries will usually match those from the corresponding Query or Queries message.
   *
   * Note: V1 protocol only supports sending disclosures as a response to a query.
   *
   * @param options multiple properties like protocol version to use, disclosure queries and thread id
   * (in case of disclosure as response to query)
   */
  public async discloseFeatures(options: DiscloseFeaturesOptions) {
    const service = this.getService(options.protocolVersion)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)
    const { message: disclosuresMessage } = await service.createDisclosure(this.agentContext, {
      disclosureQueries: options.disclosureQueries,
      threadId: options.threadId,
    })

    const outbound = createOutboundMessage(connection, disclosuresMessage)
    await this.messageSender.sendMessage(this.agentContext, outbound)
  }
}
