import type { AgentMessage } from '../../agent/AgentMessage'
import type { ConnectionRecord } from '../../modules/connections'
import type { UnpackedMessageContext } from '../../types'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import { AriesFrameworkError } from '../../error'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { replaceLegacyDidSovPrefixOnMessage } from '../../utils/messageType'
import { ConnectionService, ConnectionInvitationMessage } from '../connections'
import { DiscoverFeaturesQueryMessage, DiscoverFeaturesService } from '../discover-features'
import { MediationRecipientService } from '../routing'

import { OutOfBandMessage } from './OutOfBandMessage'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionService: ConnectionService
  private mediationRecipientService: MediationRecipientService
  private disoverFeaturesService: DiscoverFeaturesService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private dispatcher: Dispatcher

  public constructor(
    connectionService: ConnectionService,
    mediationRecipientService: MediationRecipientService,
    disoverFeaturesService: DiscoverFeaturesService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher
  ) {
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.disoverFeaturesService = disoverFeaturesService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
  }

  public async createInvitation(): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord: ConnectionRecord }> {
    // Discover what handshake protocols are supported by calling discover service.
    // Other option could be that connection service would say what protocols it supports.
    // However, that would expanded service responsibility.

    const queryMessage = new DiscoverFeaturesQueryMessage({
      query: `*`,
    })
    const featuresMessage = await this.disoverFeaturesService.createDisclose(queryMessage)
    const { protocols } = featuresMessage

    const handshakeProtocols = ['https://didcomm.org/didexchange', 'https://didcomm.org/connections']

    const supportedHandshakeProtocols = protocols
      .map((p) => p.protocolId.slice(0, -1))
      .filter((pId) => handshakeProtocols.find((hp) => pId.startsWith(hp)))

    // Create connection
    // It's a question if we need to create connection here. We could create just OutOfBand record.
    // The OOB record can be also used for connection-less communication in general.
    // Either way, we need to get routing
    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      routing,
    })

    const outOfBandMessage = new OutOfBandMessage({
      goal: 'To issue a Faber College Graduate credential',
      goalCode: 'issue-vc',
      label: 'Faber College',
    })

    outOfBandMessage.accept.push('didcomm/aip2;env=rfc587')
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc19')

    connectionRecord.didDoc.didCommServices.forEach((s) => outOfBandMessage.services.push(s))
    supportedHandshakeProtocols.forEach((p) => outOfBandMessage.handshakeProtocols.push(p))

    return { outOfBandMessage, connectionRecord }
  }

  public async receiveInvitation(outOfBandMessage: OutOfBandMessage, config: { autoAccept: boolean }) {
    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const invitation = new ConnectionInvitationMessage({ label: 'connection label', ...outOfBandMessage.services[0] })

    let connectionRecord = await this.connectionService.processInvitation(invitation, { routing })
    if (config.autoAccept) {
      connectionRecord = await this.acceptInvitation(connectionRecord.id)
    }

    this.connectionService
      .returnWhenIsConnected(connectionRecord.id)
      .then((connection) => {
        const messages = outOfBandMessage.getRequests()
        messages.forEach(async (unpackedMessage) => {
          // We can't use event emitter because it will pass unpacked message into MessageReceiver without keys therefore we won't be able to find the connection created in previous step
          // this.eventEmitter.emit<AgentMessageReceivedEvent>({
          //   type: AgentEventTypes.AgentMessageReceived,
          //   payload: {
          //     message,
          //   },
          // })
          try {
            const message = await this.transformMessage({ message: unpackedMessage })
            const messageContext = new InboundMessageContext(message, {
              // Only make the connection available in message context if the connection is ready
              // To prevent unwanted usage of unready connections. Connections can still be retrieved from
              // Storage if the specific protocol allows an unready connection to be used.
              connection: connection?.isReady ? connection : undefined,
              // senderVerkey: senderKey,
              // recipientVerkey: recipientKey,
            })
            await this.dispatcher.dispatch(messageContext)
          } catch (error: any) {
            // eslint-disable-next-line no-console
            console.error('message dispatch error', error, error.message)
          }
        })
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('error', error, error.message)
      })

    return connectionRecord
  }

  // TODO This is copy-pasted from ConnectionModule
  private async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
    return connectionRecord
  }

  /**
   * Transform an unpacked DIDComm message into it's corresponding message class. Will look at all message types in the registered handlers.
   *
   * @param unpackedMessage the unpacked message for which to transform the message in to a class instance
   */
  private async transformMessage(unpackedMessage: UnpackedMessageContext): Promise<AgentMessage> {
    // replace did:sov:BzCbsNYhMrjHiqZDTUASHg;spec prefix for message type with https://didcomm.org
    replaceLegacyDidSovPrefixOnMessage(unpackedMessage.message)

    const messageType = unpackedMessage.message['@type']
    const MessageClass = this.dispatcher.getMessageClassForType(messageType)

    if (!MessageClass) {
      throw new AriesFrameworkError(`No message class found for message type "${messageType}"`)
    }

    // Cast the plain JSON object to specific instance of Message extended from AgentMessage
    const message = JsonTransformer.fromJSON(unpackedMessage.message, MessageClass)

    return message
  }
}
