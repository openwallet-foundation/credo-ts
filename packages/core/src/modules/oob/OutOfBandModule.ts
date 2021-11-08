import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { ConnectionRecord } from '../../modules/connections'
import type { OutOfBandMessageOptions } from './OutOfBandMessage'

import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionService, ConnectionInvitationMessage } from '../connections'
import { DiscoverFeaturesQueryMessage, DiscoverFeaturesService } from '../discover-features'
import { MediationRecipientService } from '../routing'

import { OutOfBandMessage } from './OutOfBandMessage'

// TODO
// handshake and requests-attach can be undefined

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionService: ConnectionService
  private mediationRecipientService: MediationRecipientService
  private disoverFeaturesService: DiscoverFeaturesService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    connectionService: ConnectionService,
    mediationRecipientService: MediationRecipientService,
    disoverFeaturesService: DiscoverFeaturesService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.disoverFeaturesService = disoverFeaturesService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
  }

  public async createInvitation(
    options: OutOfBandMessageOptions
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord: ConnectionRecord }> {
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
    const { connectionRecord: connectionRecord } = await this.connectionService.createInvitation({
      routing,
    })

    const outOfBandMessage = new OutOfBandMessage(options)
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

    if (outOfBandMessage.getRequests().length > 0) {
      throw new AriesFrameworkError('OOB invitation contains unsupported `request~attach` attribute.')
    }

    return connectionRecord
  }

  public async createOobMessage(message: AgentMessage, options: OutOfBandMessageOptions) {
    if (!message.service) {
      throw new AriesFrameworkError(
        `Out of band message with id ${message.id} and type ${message.type} does not have a ~service decorator`
      )
    }

    const outOfBandMessage = new OutOfBandMessage(options)
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc587')
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc19')

    // To support newer OOB messages we need to add service from message and then remove `~service` attribute from message
    outOfBandMessage.services.push(message.service.toDidCommService())
    message.service = undefined
    outOfBandMessage.addRequest(message)

    return outOfBandMessage
  }

  public async receiveOobMessage(outOfBandMessage: OutOfBandMessage) {
    if (outOfBandMessage.handshakeProtocols.length > 0) {
      throw new AriesFrameworkError('OOB message contains unsupported `handshake_protocols` attribute.')
    }

    const messages = outOfBandMessage.getRequests()
    for (const unpackedMessage of messages) {
      // To support older OOB messages we need to decorate message with `~service` attribute
      const [service] = outOfBandMessage.services
      unpackedMessage['~service'] = service

      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: unpackedMessage,
        },
      })
    }
  }

  // TODO This is copy-pasted from ConnectionModule
  private async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
    return connectionRecord
  }
}
