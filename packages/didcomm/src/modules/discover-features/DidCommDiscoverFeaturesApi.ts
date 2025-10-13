import { AgentContext, CredoError, EventEmitter, InjectionSymbols, inject, injectable } from '@credo-ts/core'
import { firstValueFrom, of, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, first, map, takeUntil, timeout } from 'rxjs/operators'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import type { DidCommFeature } from '../../models'
import { DidCommOutboundMessageContext } from '../../models'
import { DidCommConnectionService } from '../connections'
import type {
  DiscloseFeaturesOptions,
  DiscoverFeaturesServiceMap,
  QueryFeaturesOptions,
} from './DidCommDiscoverFeaturesApiOptions'
import type { DidCommDiscoverFeaturesDisclosureReceivedEvent } from './DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesEventTypes } from './DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesModuleConfig } from './DidCommDiscoverFeaturesModuleConfig'
import { DidCommDiscoverFeaturesV1Service, DidCommDiscoverFeaturesV2Service } from './protocol'
import type { DidCommDiscoverFeaturesService } from './services'

export interface QueryFeaturesReturnType {
  features?: DidCommFeature[]
}

export interface DidCommDiscoverFeaturesApi<DFSs extends DidCommDiscoverFeaturesService[]> {
  queryFeatures(options: QueryFeaturesOptions<DFSs>): Promise<QueryFeaturesReturnType>
  discloseFeatures(options: DiscloseFeaturesOptions<DFSs>): Promise<void>
}
@injectable()
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: no explanation
export class DidCommDiscoverFeaturesApi<
  DFSs extends DidCommDiscoverFeaturesService[] = [DidCommDiscoverFeaturesV1Service, DidCommDiscoverFeaturesV2Service],
> implements DidCommDiscoverFeaturesApi<DFSs>
{
  /**
   * Configuration for Discover Features module
   */
  public readonly config: DidCommDiscoverFeaturesModuleConfig

  private connectionService: DidCommConnectionService
  private messageSender: DidCommMessageSender
  private eventEmitter: EventEmitter
  private stop$: Subject<boolean>
  private agentContext: AgentContext
  private serviceMap: DiscoverFeaturesServiceMap<DFSs>

  public constructor(
    connectionService: DidCommConnectionService,
    messageSender: DidCommMessageSender,
    v1Service: DidCommDiscoverFeaturesV1Service,
    v2Service: DidCommDiscoverFeaturesV2Service,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    agentContext: AgentContext,
    config: DidCommDiscoverFeaturesModuleConfig
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.stop$ = stop$
    this.agentContext = agentContext
    this.config = config

    // Dynamically build service map. This will be extracted once services are registered dynamically
    this.serviceMap = [v1Service, v2Service].reduce(
      (serviceMap, service) => ({
        // biome-ignore lint/performance/noAccumulatingSpread: no explanation
        ...serviceMap,
        [service.version]: service,
      }),
      {}
    ) as DiscoverFeaturesServiceMap<DFSs>
  }

  public getService<PVT extends DidCommDiscoverFeaturesService['version']>(
    protocolVersion: PVT
  ): DidCommDiscoverFeaturesService {
    if (!this.serviceMap[protocolVersion]) {
      throw new CredoError(`No discover features service registered for protocol version ${protocolVersion}`)
    }

    return this.serviceMap[protocolVersion] as unknown as DidCommDiscoverFeaturesService
  }

  /**
   * Send a query to an existing connection for discovering supported features of any kind. If desired, do the query synchronously,
   * meaning that it will await the response (or timeout) before resolving. Otherwise, response can be hooked by subscribing to
   * {DiscoverFeaturesDisclosureReceivedEvent}.
   *
   * Note: V1 protocol only supports a single query and is limited to protocols
   *
   * @param options feature queries to perform, protocol version and optional comment string (only used
   * in V1 protocol). If awaitDisclosures is set, perform the query synchronously with awaitDisclosuresTimeoutMs timeout.
   */
  public async queryFeatures(options: QueryFeaturesOptions<DFSs>) {
    const service = this.getService(options.protocolVersion)

    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    const { message: queryMessage } = await service.createQuery({
      queries: options.queries,
      comment: options.comment,
    })

    const outboundMessageContext = new DidCommOutboundMessageContext(queryMessage, {
      agentContext: this.agentContext,
      connection,
    })

    const replaySubject = new ReplaySubject<DidCommFeature[]>(1)
    if (options.awaitDisclosures) {
      // Listen for response to our feature query
      this.eventEmitter
        .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(
          DidCommDiscoverFeaturesEventTypes.DisclosureReceived
        )
        .pipe(
          // Stop when the agent shuts down
          takeUntil(this.stop$),
          // filter by connection id
          filter((e) => e.payload.connection?.id === connection.id),
          // Return disclosures
          map((e) => e.payload.disclosures),
          // Only wait for first event that matches the criteria
          first(),
          // If we don't have an answer in timeoutMs miliseconds (no response, not supported, etc...) error
          timeout({
            first: options.awaitDisclosuresTimeoutMs ?? 7000,
            meta: 'DiscoverFeaturesApi.queryFeatures',
          }), // TODO: Harmonize default timeouts across the framework
          // We want to return false if an error occurred
          catchError(() => of([]))
        )
        .subscribe(replaySubject)
    }

    await this.messageSender.sendMessage(outboundMessageContext)

    return { features: options.awaitDisclosures ? await firstValueFrom(replaySubject) : undefined }
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
    const { message: disclosuresMessage } = await service.createDisclosure({
      disclosureQueries: options.disclosureQueries,
      threadId: options.threadId,
    })

    const outboundMessageContext = new DidCommOutboundMessageContext(disclosuresMessage, {
      agentContext: this.agentContext,
      connection,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }
}
