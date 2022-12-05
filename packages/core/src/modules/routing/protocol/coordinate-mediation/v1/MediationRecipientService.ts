import type { AgentContext } from '../../../../../agent'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommV1Message } from '../../../../../didcomm/versions/v1'
import type { ConnectionRecord } from '../../../../connections'
import type { Routing } from '../../../../connections/services/ConnectionService'
import type { KeylistUpdatedEvent } from '../../../RoutingEvents'
import type { GetRoutingOptions } from '../../../services/MediationService'
import type { StatusMessage } from '../../index'
import type { MediationDenyMessage } from './messages'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { filterContextCorrelationId } from '../../../../../agent/Events'
import { MessageSender } from '../../../../../agent/MessageSender'
import { OutboundMessageContext } from '../../../../../agent/models/'
import { Key, KeyType } from '../../../../../crypto'
import { injectable } from '../../../../../plugins'
import { ConnectionType } from '../../../../connections/models/ConnectionType'
import { TrustPingMessage } from '../../../../connections/protocols/trust-ping/v1/messages'
import { ConnectionMetadataKeys } from '../../../../connections/repository/ConnectionMetadataTypes'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { didKeyToVerkey, isDidKey, verkeyToDidKey } from '../../../../dids/helpers'
import { RecipientModuleConfig } from '../../../RecipientModuleConfig'
import { RoutingEventTypes } from '../../../RoutingEvents'
import { MediationRole, MediationState } from '../../../models'
import { MediationRecord } from '../../../repository/MediationRecord'
import { MediationRepository } from '../../../repository/MediationRepository'
import { DeliveryRequestMessage, StatusRequestMessage } from '../../pickup/v2/messages'
import { MediationRecipientSharedService } from '../MediationRecipientSharedService'

import { KeylistUpdateResponseHandler, MediationDenyHandler, MediationGrantHandler } from './handlers'
import {
  KeylistUpdateAction,
  KeylistUpdateResponseMessage,
  MediationRequestMessage,
  MediationGrantMessage,
} from './messages'
import { KeylistUpdate, KeylistUpdateMessage } from './messages/KeylistUpdateMessage'

@injectable()
export class MediationRecipientService extends MediationRecipientSharedService {
  public constructor(
    connectionService: ConnectionService,
    messageSender: MessageSender,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    recipientModuleConfig: RecipientModuleConfig
  ) {
    super(connectionService, messageSender, mediatorRepository, eventEmitter, dispatcher, recipientModuleConfig)

    this.registerHandlers()
  }

  public async createStatusRequest(
    mediationRecord: MediationRecord,
    config: {
      recipientKey?: string
    } = {}
  ) {
    mediationRecord.assertRole(MediationRole.Recipient)
    mediationRecord.assertReady()

    const { recipientKey } = config
    const statusRequest = new StatusRequestMessage({
      recipientKey,
    })

    return statusRequest
  }

  public async createRequest(
    agentContext: AgentContext,
    connection: ConnectionRecord
  ): Promise<MediationProtocolMsgReturnType<MediationRequestMessage>> {
    const message = new MediationRequestMessage({})

    const mediationRecord = new MediationRecord({
      threadId: message.threadId,
      state: MediationState.Requested,
      role: MediationRole.Recipient,
      connectionId: connection.id,
    })
    connection.setTag('connectionType', [ConnectionType.Mediator])
    await this.connectionService.update(agentContext, connection)

    await this.mediationRepository.save(agentContext, mediationRecord)
    this.emitStateChangedEvent(agentContext, mediationRecord, null)

    return { mediationRecord, message }
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Recipient)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = messageContext.message.routingKeys.some(isDidKey)
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      MediationGrantMessage.type.protocolUri,
      connectionUsesDidKey
    )

    // According to RFC 0211 keys should be a did key, but base58 encoded verkey was used before
    // RFC was accepted. This converts the key to a public key base58 if it is a did key.
    mediationRecord.routingKeys = messageContext.message.routingKeys.map(didKeyToVerkey)
    return await this.updateState(messageContext.agentContext, mediationRecord, MediationState.Granted)
  }

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    // Assert
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    const keylist = messageContext.message.updated

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = keylist.some((key) => isDidKey(key.recipientKey))
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      KeylistUpdateResponseMessage.type.protocolUri,
      connectionUsesDidKey
    )

    // update keylist in mediationRecord
    for (const update of keylist) {
      if (update.action === KeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(didKeyToVerkey(update.recipientKey))
      } else if (update.action === KeylistUpdateAction.remove) {
        mediationRecord.removeRecipientKey(didKeyToVerkey(update.recipientKey))
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)
    this.eventEmitter.emit<KeylistUpdatedEvent>(messageContext.agentContext, {
      type: RoutingEventTypes.RecipientKeylistUpdated,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async keylistUpdateAndAwait(
    agentContext: AgentContext,
    mediationRecord: MediationRecord,
    verKey: string,
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<MediationRecord> {
    const connection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)

    // Use our useDidKey configuration unless we know the key formatting other party is using
    let useDidKey = agentContext.config.useDidKeyInProtocols

    const useDidKeysConnectionMetadata = connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol)
    if (useDidKeysConnectionMetadata) {
      useDidKey = useDidKeysConnectionMetadata[KeylistUpdateMessage.type.protocolUri] ?? useDidKey
    }

    const message = this.createKeylistUpdateMessage(useDidKey ? verkeyToDidKey(verKey) : verKey)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Recipient)

    // Create observable for event
    const observable = this.eventEmitter.observable<KeylistUpdatedEvent>(RoutingEventTypes.RecipientKeylistUpdated)
    const subject = new ReplaySubject<KeylistUpdatedEvent>(1)

    // Apply required filters to observable stream and create promise to subscribe to observable
    observable
      .pipe(
        filterContextCorrelationId(agentContext.contextCorrelationId),
        // Only take event for current mediation record
        filter((event) => mediationRecord.id === event.payload.mediationRecord.id),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .subscribe(subject)

    const outboundMessageContext = new OutboundMessageContext(message, { agentContext, connection })
    await this.messageSender.sendMessage(outboundMessageContext)

    const keylistUpdate = await firstValueFrom(subject)
    return keylistUpdate.payload.mediationRecord
  }

  public createKeylistUpdateMessage(verkey: string): KeylistUpdateMessage {
    const keylistUpdateMessage = new KeylistUpdateMessage({
      updates: [
        new KeylistUpdate({
          action: KeylistUpdateAction.add,
          recipientKey: verkey,
        }),
      ],
    })
    return keylistUpdateMessage
  }

  public async addMediationRouting(
    agentContext: AgentContext,
    routing: Routing,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<Routing> {
    let mediationRecord: MediationRecord | null = null

    if (mediatorId) {
      mediationRecord = await this.getById(agentContext, mediatorId)
    } else if (useDefaultMediator) {
      // If no mediatorId is provided, and useDefaultMediator is true (default)
      // We use the default mediator if available
      mediationRecord = await this.findDefaultMediator(agentContext)
    }

    // Return early if no mediation record
    if (!mediationRecord) return routing

    // new did has been created and mediator needs to be updated with the public key.
    mediationRecord = await this.keylistUpdateAndAwait(
      agentContext,
      mediationRecord,
      routing.recipientKey.publicKeyBase58
    )

    return {
      ...routing,
      endpoints: mediationRecord.endpoint ? [mediationRecord.endpoint] : routing.endpoints,
      routingKeys: mediationRecord.routingKeys.map((key) => Key.fromPublicKeyBase58(key, KeyType.Ed25519)),
    }
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.assertReadyConnection()

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.agentContext, connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertRole(MediationRole.Recipient)
    mediationRecord.assertState(MediationState.Requested)

    // Update record
    await this.updateState(messageContext.agentContext, mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  public async processStatus(messageContext: InboundMessageContext<StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const { message: statusMessage } = messageContext
    const { messageCount, recipientKey } = statusMessage

    //No messages to be sent
    if (messageCount === 0) {
      const { message, connectionRecord } = await this.connectionService.createTrustPing(
        messageContext.agentContext,
        connection,
        {
          responseRequested: false,
        }
      )

      if (message instanceof TrustPingMessage) {
        const websocketSchemes = ['ws', 'wss']
        await this.messageSender.sendMessage(
          new OutboundMessageContext(message, {
            agentContext: messageContext.agentContext,
            connection: connectionRecord,
          }),
          {
            transportPriority: {
              schemes: websocketSchemes,
              restrictive: true,
              // TODO: add keepAlive: true to enforce through the public api
              // we need to keep the socket alive. It already works this way, but would
              // be good to make more explicit from the public facing API.
              // This would also make it easier to change the internal API later on.
              // keepAlive: true,
            },
          }
        )

        return null
      }
    }
    const { maximumMessagePickup } = this.recipientModuleConfig
    const limit = messageCount < maximumMessagePickup ? messageCount : maximumMessagePickup

    const deliveryRequestMessage = new DeliveryRequestMessage({
      limit,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  private async updateUseDidKeysFlag(
    agentContext: AgentContext,
    connection: ConnectionRecord,
    protocolUri: string,
    connectionUsesDidKey: boolean
  ) {
    const useDidKeysForProtocol = connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol) ?? {}
    useDidKeysForProtocol[protocolUri] = connectionUsesDidKey
    connection.metadata.set(ConnectionMetadataKeys.UseDidKeysForProtocol, useDidKeysForProtocol)
    await this.connectionService.update(agentContext, connection)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new KeylistUpdateResponseHandler(this))
    this.dispatcher.registerHandler(new MediationGrantHandler(this))
    this.dispatcher.registerHandler(new MediationDenyHandler(this))
  }
}

export interface MediationProtocolMsgReturnType<MessageType extends DidCommV1Message> {
  message: MessageType
  mediationRecord: MediationRecord
}
