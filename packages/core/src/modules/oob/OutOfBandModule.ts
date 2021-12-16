import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { Logger } from '../../logger'
import type { ConnectionRecord, ConnectionStateChangedEvent } from '../connections'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConsoleLogger, LogLevel } from '../../logger'
import {
  ConnectionService,
  ConnectionInvitationMessage,
  DidCommService,
  ConnectionEventTypes,
  ConnectionState,
} from '../connections'
import { MediationRecipientService } from '../routing'

import { HandshakeReuseHandler } from './handlers'
import { OutOfBandMessage, HandshakeReuseMessage } from './messages'

interface CreateOutOfBandMessageConfig {
  label?: string
  goalCode?: string
  goal?: string
  handshake: boolean
  multiUseInvitation: boolean
}

interface ReceiveOutOfBandMessageConfig {
  autoAccept: boolean
  reuse?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionService: ConnectionService
  private mediationRecipientService: MediationRecipientService
  private dispatcher: Dispatcher
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger = new ConsoleLogger(LogLevel.debug)

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.dispatcher = dispatcher
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
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
    config: CreateOutOfBandMessageConfig,
    messages?: AgentMessage[]
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord?: ConnectionRecord }> {
    const { handshake, multiUseInvitation } = config
    if (!handshake && !messages) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    const routing = await this.mediationRecipientService.getRouting()

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

    if (handshake) {
      // Discover what handshake protocols are supported
      const supportedHandshakeProtocols = this.getSupportedHandshakeProtocols()
      const connectionProtocolMessage = await this.connectionService.createInvitation({
        routing,
        multiUseInvitation,
      })
      connectionRecord = connectionProtocolMessage.connectionRecord
      outOfBandMessage.handshakeProtocols = supportedHandshakeProtocols
    }

    if (messages) {
      messages.forEach((message) => {
        if (message.service) {
          // We can remove `~service` attribute from message. Newer OOB messages have `services` attribute instead.
          message.service = undefined
        }
        outOfBandMessage.addRequest(message)
      })
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
    config: ReceiveOutOfBandMessageConfig
  ): Promise<ConnectionRecord | undefined> {
    const { handshakeProtocols, services } = outOfBandMessage
    const { autoAccept, reuse } = config
    const messages = outOfBandMessage.getRequests()

    if ((!handshakeProtocols || handshakeProtocols.length === 0) && (!messages || messages?.length === 0)) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    let connectionRecord: ConnectionRecord

    if (handshakeProtocols) {
      if (!this.areHandshakeProtocolsSupported(handshakeProtocols)) {
        throw new AriesFrameworkError('Handshake protocols are not supported.')
      }

      const existingConnection = await this.findExistingConnection(services)
      if (existingConnection) {
        this.logger.debug('Connection already exists.', { connectionId: existingConnection.id })
        if (reuse) {
          this.logger.debug('Reuse is enabled. Reusing an existing connection.')
          connectionRecord = existingConnection
          if (!messages) {
            this.logger.debug('Out of band message does not contain any request messages.')
            await this.sendReuse(connectionRecord)
          }
        } else {
          this.logger.debug('Reuse is disabled. Creating a new connection.')
          connectionRecord = await this.createConnection(services, autoAccept)
        }
      } else {
        connectionRecord = await this.createConnection(services, autoAccept)
      }

      if (messages) {
        this.logger.debug('Out of band message contains request messages.')
        if (!connectionRecord.isReady) {
          // Wait until the connecion is ready and then pass the messages to the agent for further processing
          this.eventEmitter.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged, (event) => {
            const { payload } = event
            if (
              payload.connectionRecord.id === connectionRecord.id &&
              payload.connectionRecord.state === ConnectionState.Complete
            ) {
              const connectionServices = payload.connectionRecord.theirDidDoc?.didCommServices
              this.emitMessages(connectionServices, messages)
            }
          })
        } else {
          const connectionServices = connectionRecord.theirDidDoc?.didCommServices
          this.emitMessages(connectionServices, messages)
        }
      }

      return connectionRecord
    } else if (messages) {
      this.emitMessages(services, messages)
    }
  }

  private areHandshakeProtocolsSupported(handshakeProtocols: string[]) {
    return this.getSupportedHandshakeProtocols().some((p) => handshakeProtocols.includes(p))
  }

  private getSupportedHandshakeProtocols() {
    const handshakeMessageFamilies = ['https://didcomm.org/didexchange', 'https://didcomm.org/connections']
    const handshakeProtocols = this.dispatcher.filterSupportedProtocolsByMessageFamilies(handshakeMessageFamilies)

    if (handshakeProtocols.length === 0) {
      throw new AriesFrameworkError('There is no handshake protocol supported. Agent can not create a connection.')
    }

    return handshakeProtocols
  }

  private async findExistingConnection(services: DidCommService[]) {
    const [service] = services
    const existingConnection = await this.connectionService.findByTheirKey(service.recipientKeys[0])
    return existingConnection
  }

  private async createConnection(services: DidCommService[], autoAccept: boolean) {
    const routing = await this.mediationRecipientService.getRouting()
    const invitation = new ConnectionInvitationMessage({
      label: 'connection label',
      ...services[0],
    })
    let connectionRecord = await this.connectionService.processInvitation(invitation, { routing })
    if (autoAccept) {
      connectionRecord = await this.acceptInvitation(connectionRecord.id)
    }
    return connectionRecord
  }

  // TODO This is copy-pasted from ConnectionModule
  private async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
    return connectionRecord
  }

  private emitMessages(services: DidCommService[] | undefined, messages: any[]) {
    if (!services || services.length === 0) {
      throw new AriesFrameworkError(`There are no services. We can not emit messages`)
    }

    for (const unpackedMessage of messages) {
      // The framework currently supports only older OOB messages with `~service` decorator.
      const [service] = services
      unpackedMessage['~service'] = service

      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: unpackedMessage,
        },
      })
    }
  }

  private async sendReuse(connection: ConnectionRecord) {
    const message = new HandshakeReuseMessage({})
    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new HandshakeReuseHandler())
  }
}
