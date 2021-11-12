import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { ConnectionRecord } from '../../modules/connections'

import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionService, ConnectionInvitationMessage, DidCommService } from '../connections'
import { DiscoverFeaturesService } from '../discover-features'
import { MediationRecipientService } from '../routing'

import { OutOfBandMessage } from './OutOfBandMessage'

interface OutOfBandMessageConfig {
  label?: string
  goalCode?: string
  goal?: string
  handshake: boolean
}

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
   * Creates an out-of-band message and adds given agent message to `requests~attach` attribute.
   * Creates new connection record and use its keys for out-of-band message that works as a connection invitation.
   * It uses discover features to find out what handshake protocols the agent supports.
   *
   * @param config Optinal attributes contained in out-of-band message
   * @param message A message that will be send inside out-of-band message
   * @returns Out-of-band message
   */
  public async createMessage(
    config: OutOfBandMessageConfig,
    message?: AgentMessage
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord?: ConnectionRecord }> {
    if (!config.handshake && !message) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)

    const service = new DidCommService({
      id: '#inline', // TODO generate uuid?
      priority: 0,
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })

    const options = {
      ...config,
      accept: ['didcomm/aip1'],
      services: [service],
    }
    const outOfBandMessage = new OutOfBandMessage(options)

    // Eventually, we can create just an OutOfBand record here.
    // The OOB record can be also used for connection-less communication in general.
    // When we create oob record we need to count with it inside connection request handler.
    let connectionRecord: ConnectionRecord | undefined

    if (config.handshake) {
      // Discover what handshake protocols are supported
      const handshakeProtocols = ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0']
      const supportedHandshakeProtocols = this.disoverFeaturesService.getSupportedProtocols(handshakeProtocols)

      if (supportedHandshakeProtocols.length === 0) {
        throw new AriesFrameworkError('There is no handshake protocol supported. Agent can not create a connection.')
      }

      const connectionProtocolMessage = await this.connectionService.createInvitation({
        routing,
      })
      connectionRecord = connectionProtocolMessage.connectionRecord
      outOfBandMessage.handshakeProtocols = supportedHandshakeProtocols
    }

    if (message) {
      if (message.service) {
        // We can remove `~service` attribute from message. Newer OOB messages have `services` attribute instead.
        message.service = undefined
      }
      outOfBandMessage.addRequest(message)
    }

    return { outOfBandMessage, connectionRecord }
  }

  /**
   * Takes all messages from `requests~attach` attribute and pass them to the agent via event emitter.
   *
   * @param outOfBandMessage
   */
  public async receiveMessage(
    outOfBandMessage: OutOfBandMessage,
    config: { autoAccept: boolean }
  ): Promise<ConnectionRecord | undefined> {
    const messages = outOfBandMessage.getRequests()
    if (outOfBandMessage.handshakeProtocols && messages && messages.length > 0) {
      throw new AriesFrameworkError(
        'Current OOB message implementation can not support both `handshake_protocols` and `request~attach` toghether in a message.'
      )
    }

    if (outOfBandMessage.handshakeProtocols) {
      // TODO check if we support handshake protocols
      // TODO reuse if connection exists
      const mediationRecord = await this.mediationRecipientService.discoverMediation()
      const routing = await this.mediationRecipientService.getRouting(mediationRecord)
      const invitation = new ConnectionInvitationMessage({ label: 'connection label', ...outOfBandMessage.services[0] })
      let connectionRecord = await this.connectionService.processInvitation(invitation, { routing })
      if (config.autoAccept) {
        connectionRecord = await this.acceptInvitation(connectionRecord.id)
      }
      return connectionRecord
    }

    if (messages) {
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
  }

  // TODO This is copy-pasted from ConnectionModule
  private async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
    return connectionRecord
  }
}
