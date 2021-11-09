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
import { DiscoverFeaturesService } from '../discover-features'
import { MediationRecipientService } from '../routing'

import { OutOfBandMessage } from './OutOfBandMessage'

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

  /**
   * Creates new connection record and use its keys for out-of-band message that works as a connection invitation.
   * It uses discover features to find out what handshake protocols the agent supports.
   *
   * @param options Optinal attributes contained in out-of-band message
   * @returns Created connection record and out-of-band message
   */
  public async createInvitation(
    options: OutOfBandMessageOptions
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord: ConnectionRecord }> {
    // Discover what handshake protocols are supported
    const handshakeProtocols = ['https://didcomm.org/didexchange', 'https://didcomm.org/connections']
    const supportedHandshakeProtocols = this.disoverFeaturesService.getSupportedProtocols(handshakeProtocols)
    if (supportedHandshakeProtocols.length === 0) {
      throw new AriesFrameworkError('There is no handshake protocol supported. Agent can not create a connection.')
    }

    // Create connection.
    // Eventually, we can create just an OutOfBand record here.
    // The OOB record can be also used for connection-less communication in general.
    // Either way, we need to get routing
    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const { connectionRecord } = await this.connectionService.createInvitation({
      routing,
    })

    const outOfBandMessage = new OutOfBandMessage(options)
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc587')
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc19')
    supportedHandshakeProtocols.forEach((p) => outOfBandMessage.addHandshakeProtocol(p))
    connectionRecord.didDoc.didCommServices.forEach((s) => outOfBandMessage.addService(s))

    return { outOfBandMessage, connectionRecord }
  }

  /**
   * Creates a connection record based on out-of-band message.
   *
   * @param outOfBandMessage
   * @param config
   * @returns Connection record
   */
  public async receiveInvitation(
    outOfBandMessage: OutOfBandMessage,
    config: { autoAccept: boolean }
  ): Promise<ConnectionRecord> {
    if (!outOfBandMessage.handshakeProtocols || outOfBandMessage.handshakeProtocols.length === 0) {
      throw new AriesFrameworkError('Missing required `handshake_protocols` attribute in OOB message.')
    }

    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const invitation = new ConnectionInvitationMessage({ label: 'connection label', ...outOfBandMessage.services[0] })

    let connectionRecord = await this.connectionService.processInvitation(invitation, { routing })
    if (config.autoAccept) {
      connectionRecord = await this.acceptInvitation(connectionRecord.id)
    }

    if (outOfBandMessage.getRequests()) {
      throw new AriesFrameworkError('OOB invitation contains unsupported `request~attach` attribute.')
    }

    return connectionRecord
  }

  /**
   * Creates an out-of-band message and adds given agent message to `requests~attach` attribute.
   *
   * @param message A message that will be send inside out-of-band message
   * @param options Optinal attributes contained in out-of-band message
   * @returns Out-of-band message
   */
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

  /**
   * Takes all messages from `requests~attach` attribute and pass them to the agent via event emitter.
   *
   * @param outOfBandMessage
   */
  public async receiveOobMessage(outOfBandMessage: OutOfBandMessage): Promise<void> {
    if (outOfBandMessage.handshakeProtocols) {
      throw new AriesFrameworkError('OOB message contains unsupported `handshake_protocols` attribute.')
    }

    const messages = outOfBandMessage.getRequests()

    if (!messages || messages.length === 0) {
      throw new AriesFrameworkError('Missing required `request~attach` attribute in OOB message.')
    }

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
