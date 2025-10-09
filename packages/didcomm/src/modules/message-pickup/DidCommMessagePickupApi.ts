import type {
  DeliverMessagesFromQueueOptions,
  DeliverMessagesFromQueueReturnType,
  DeliverMessagesOptions,
  DeliverMessagesReturnType,
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
  SetLiveDeliveryModeOptions,
  SetLiveDeliveryModeReturnType,
} from './DidCommMessagePickupApiOptions'
import type { MessagePickupCompletedEvent } from './DidCommMessagePickupEvents'
import type { DidCommMessagePickupSession, DidCommMessagePickupSessionRole } from './DidCommMessagePickupSession'
import type { DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol } from './protocol'
import type { DidCommMessagePickupProtocol } from './protocol/DidCommMessagePickupProtocol'

import {
  AgentContext,
  CredoError,
  EventEmitter,
  InjectionSymbols,
  type Logger,
  inject,
  injectable,
} from '@credo-ts/core'
import { ReplaySubject, Subject, filter, first, firstValueFrom, takeUntil, timeout } from 'rxjs'

import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommOutboundMessageContext } from '../../models'
import { DidCommConnectionService } from '../connections/services'

import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommMessagePickupEventTypes } from './DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from './DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionService } from './services/DidCommMessagePickupSessionService'

export interface DidCommMessagePickupApi<MPPs extends DidCommMessagePickupProtocol[]> {
  queueMessage(options: QueueMessageOptions): Promise<QueueMessageReturnType>
  pickupMessages(options: PickupMessagesOptions<MPPs>): Promise<PickupMessagesReturnType>
  getLiveModeSession(options: {
    connectionId: string
    role?: DidCommMessagePickupSessionRole
  }): Promise<DidCommMessagePickupSession | undefined>
  deliverMessages(options: DeliverMessagesOptions): Promise<DeliverMessagesReturnType>
  deliverMessagesFromQueue(options: DeliverMessagesFromQueueOptions): Promise<DeliverMessagesFromQueueReturnType>
  setLiveDeliveryMode(options: SetLiveDeliveryModeOptions): Promise<SetLiveDeliveryModeReturnType>
}

@injectable()
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: <explanation>
export class DidCommMessagePickupApi<
  MPPs extends DidCommMessagePickupProtocol[] = [DidCommMessagePickupV1Protocol, DidCommMessagePickupV2Protocol],
> implements DidCommMessagePickupApi<MPPs>
{
  public config: DidCommMessagePickupModuleConfig<MPPs>

  private messageSender: DidCommMessageSender
  private agentContext: AgentContext
  private eventEmitter: EventEmitter
  private connectionService: DidCommConnectionService
  private messagePickupSessionService: DidCommMessagePickupSessionService
  private logger: Logger
  private stop$: Subject<boolean>

  public constructor(
    messageSender: DidCommMessageSender,
    agentContext: AgentContext,
    connectionService: DidCommConnectionService,
    eventEmitter: EventEmitter,
    messagePickupSessionService: DidCommMessagePickupSessionService,
    config: DidCommMessagePickupModuleConfig<MPPs>,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.eventEmitter = eventEmitter
    this.config = config
    this.messagePickupSessionService = messagePickupSessionService
    this.stop$ = stop$
    this.logger = logger
  }

  private getProtocol<MPP extends MPPs[number]['version']>(protocolVersion: MPP): DidCommMessagePickupProtocol {
    const protocol = this.config.protocols.find((protocol) => protocol.version === protocolVersion)

    if (!protocol) {
      throw new CredoError(`No message pickup protocol registered for protocol version ${protocolVersion}`)
    }

    return protocol
  }

  /**
   * Add an encrypted message to the message pickup queue
   *
   * @param options: connectionId associated to the message and the encrypted message itself
   */
  public async queueMessage(options: QueueMessageOptions): Promise<QueueMessageReturnType> {
    this.logger.debug('Queuing message...')
    const { connectionId, message, recipientDids } = options
    const connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)

    const queueTransportRepository =
      this.agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    await queueTransportRepository.addMessage(this.agentContext, {
      connectionId: connectionRecord.id,
      recipientDids,
      payload: message,
    })
  }

  /**
   * Get current active live mode message pickup session for a given connection. Undefined if no active session found
   *
   * @param options connection id and optional role
   * @returns live mode session
   */
  public async getLiveModeSession(options: { connectionId: string; role?: DidCommMessagePickupSessionRole }) {
    const { connectionId, role } = options
    return this.messagePickupSessionService.getLiveSessionByConnectionId(this.agentContext, { connectionId, role })
  }

  /**
   * Deliver specific messages to an active live mode pickup session through message pickup protocol.
   *
   * This will deliver the messages regardless of the state of the message pickup queue, meaning that
   * any message stuck there should be sent separately (e.g. using deliverQU).
   *
   * @param options: pickup session id and the messages to deliver
   */
  public async deliverMessages(options: DeliverMessagesOptions) {
    const { pickupSessionId, messages } = options

    const session = this.messagePickupSessionService.getLiveSession(this.agentContext, pickupSessionId)

    if (!session) {
      throw new CredoError(`No active live mode session found with id ${pickupSessionId}`)
    }

    const connectionRecord = await this.connectionService.getById(this.agentContext, session.connectionId)

    const protocol = this.getProtocol(session.protocolVersion)

    const createDeliveryReturn = await protocol.createDeliveryMessage(this.agentContext, {
      connectionRecord,
      messages,
    })

    if (createDeliveryReturn) {
      await this.messageSender.sendMessage(
        new DidCommOutboundMessageContext(createDeliveryReturn.message, {
          agentContext: this.agentContext,
          connection: connectionRecord,
        }),
        { transportPriority: { schemes: ['wss', 'ws'] } }
      )
    }
  }

  /**
   * Deliver messages in the Message Pickup Queue for a given live mode session and key (if specified).
   *
   * This will retrieve messages up to 'batchSize' messages from the queue and deliver it through the
   * corresponding Message Pickup protocol. If there are more than 'batchSize' messages in the queue,
   * the recipient may request remaining messages after receiving the first batch of messages.
   *
   */
  public async deliverMessagesFromQueue(options: DeliverMessagesFromQueueOptions) {
    this.logger.debug('Delivering queued messages')

    const { pickupSessionId, recipientDid: recipientKey, batchSize } = options

    const session = this.messagePickupSessionService.getLiveSession(this.agentContext, pickupSessionId)

    if (!session) {
      throw new CredoError(`No active live mode session found with id ${pickupSessionId}`)
    }
    const connectionRecord = await this.connectionService.getById(this.agentContext, session.connectionId)

    const protocol = this.getProtocol(session.protocolVersion)

    const deliverMessagesReturn = await protocol.createDeliveryMessage(this.agentContext, {
      connectionRecord,
      recipientKey,
      batchSize,
    })

    if (deliverMessagesReturn) {
      await this.messageSender.sendMessage(
        new DidCommOutboundMessageContext(deliverMessagesReturn.message, {
          agentContext: this.agentContext,
          connection: connectionRecord,
        }),
        { transportPriority: { schemes: ['wss', 'ws'] } }
      )
    }
  }

  /**
   * Pickup queued messages from a message holder. It attempts to retrieve all current messages from the
   * queue, receiving up to `batchSize` messages per batch retrieval.
   *
   * By default, this method only waits until the initial pick-up request is sent. Use `options.awaitCompletion`
   * if you want to wait until all messages are effectively retrieved.
   *
   * @param options connectionId, protocol version to use and batch size, awaitCompletion,
   * awaitCompletionTimeoutMs
   */
  public async pickupMessages(options: PickupMessagesOptions<MPPs>): Promise<PickupMessagesReturnType> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const protocol = this.getProtocol(options.protocolVersion)
    const { message } = await protocol.createPickupMessage(this.agentContext, {
      connectionRecord,
      batchSize: options.batchSize,
      recipientDid: options.recipientDid,
    })

    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connectionRecord,
    })

    const replaySubject = new ReplaySubject(1)

    if (options.awaitCompletion) {
      this.eventEmitter
        .observable<MessagePickupCompletedEvent>(DidCommMessagePickupEventTypes.MessagePickupCompleted)
        .pipe(
          // Stop when the agent shuts down
          takeUntil(this.stop$),
          // filter by connection id
          filter((e) => e.payload.connection.id === connectionRecord.id),
          // Only wait for first event that matches the criteria
          first(),
          // If we don't receive all messages within timeoutMs miliseconds (no response, not supported, etc...) error
          timeout({
            first: options.awaitCompletionTimeoutMs ?? 10000,
            meta: 'DidCommMessagePickupApi.pickupMessages',
          })
        )
        .subscribe(replaySubject)
    }

    // For picking up messages we prefer a long-lived transport session, so we will set a higher priority to
    // WebSocket endpoints. However, it is not extrictly required.
    await this.messageSender.sendMessage(outboundMessageContext, { transportPriority: { schemes: ['wss', 'ws'] } })

    if (options.awaitCompletion) {
      await firstValueFrom(replaySubject)
    }
  }

  /**
   * Enable or disable Live Delivery mode as a recipient. Depending on the message pickup protocol used,
   * after receiving a response from the mediator the agent might retrieve any pending message.
   *
   * @param options connectionId, protocol version to use and boolean to enable/disable Live Mode
   */
  public async setLiveDeliveryMode(options: SetLiveDeliveryModeOptions): Promise<SetLiveDeliveryModeReturnType> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)
    const protocol = this.getProtocol(options.protocolVersion)
    const { message } = await protocol.setLiveDeliveryMode(this.agentContext, {
      connectionRecord,
      liveDelivery: options.liveDelivery,
    })

    // Live mode requires a long-lived transport session, so we'll require WebSockets to send this message
    await this.messageSender.sendMessage(
      new DidCommOutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      }),
      { transportPriority: { schemes: ['wss', 'ws'], restrictive: options.liveDelivery } }
    )
  }
}
