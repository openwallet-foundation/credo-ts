import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { Logger } from '../../logger'
import type { PlaintextMessage } from '../../types'
import type { ConnectionRecord } from '../connections'

import { parseUrl } from 'query-string'
import { EmptyError } from 'rxjs'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { AgentEventTypes } from '../../agent/Events'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionInvitationMessage, DidCommService, ConnectionState, ConnectionsModule } from '../connections'
import { MediationRecipientService } from '../routing'

import { HandshakeReuseHandler } from './handlers'
import { OutOfBandMessage, HandshakeReuseMessage } from './messages'

export interface CreateOutOfBandMessageConfig {
  label?: string
  goalCode?: string
  goal?: string
  handshake: boolean
  multiUseInvitation?: boolean
}

export interface ReceiveOutOfBandMessageConfig {
  autoAcceptConnection: boolean
  reuseConnection?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionsModule: ConnectionsModule
  private mediationRecipientService: MediationRecipientService
  private dispatcher: Dispatcher
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionsModule: ConnectionsModule,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.dispatcher = dispatcher
    this.logger = agentConfig.logger
    this.connectionsModule = connectionsModule
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  /**
   * Creates an out-of-band message and adds given agent messages to `requests~attach` attribute.
   *
   * If `handshake` is true, creates new connection record and use its keys for out-of-band message that works as a connection invitation.
   * It uses discover features to find out what handshake protocols the agent supports.
   *
   * @param config Optinal attributes contained in out-of-band message
   * @param messages Messages that will be sent inside out-of-band message
   * @returns Out-of-band message and connection record if it has been created.
   */
  public async createMessage(
    config: CreateOutOfBandMessageConfig,
    messages?: AgentMessage[]
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord?: ConnectionRecord }> {
    const { handshake, label, multiUseInvitation } = config
    if (!handshake && !messages) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    let outOfBandMessage: OutOfBandMessage

    // Eventually, we can create just an OutOfBand record here.
    // The OOB record can be also used for connection-less communication in general.
    // When we create oob record we need to count with it inside connection request handler.
    let connectionRecord: ConnectionRecord | undefined

    if (handshake) {
      const connectionWithInvitation = await this.connectionsModule.createConnection({
        myLabel: label,
        multiUseInvitation,
      })

      connectionRecord = connectionWithInvitation.connectionRecord
      const services = connectionRecord.didDoc.didCommServices.map((s) => {
        return new DidCommService({
          id: `${connectionRecord?.did};#${s.priority}`,
          priority: 0,
          serviceEndpoint: s.serviceEndpoint,
          recipientKeys: s.recipientKeys,
          routingKeys: s.routingKeys,
        })
      })

      // Discover what handshake protocols are supported
      const handshakeProtocols = this.getSupportedHandshakeProtocols()

      const options = {
        ...config,
        accept: ['didcomm/aip1'],
        services,
        handshakeProtocols,
      }
      outOfBandMessage = new OutOfBandMessage(options)
    } else {
      const routing = await this.mediationRecipientService.getRouting()
      const service = new DidCommService({
        id: '#inline',
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
      outOfBandMessage = new OutOfBandMessage(options)
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
   * Parses URL, decodes invitation and eventually creates a new connection record.
   * It supports both OOB (Aries RFC 0434: Out-of-Band Protocol 1.1) and Connection Invitation (0160: Connection Protocol).
   *
   * @param urlMessage URL containing encoded invitation
   * @param config Configuration of how to process given invitation.
   * @returns Connection record if it has been created.
   */
  public async receiveInvitationFromUrl(urlMessage: string, config: ReceiveOutOfBandMessageConfig) {
    const parsedUrl = parseUrl(urlMessage).query
    if (parsedUrl['oob']) {
      const outOfBandMessage = await OutOfBandMessage.fromUrl(urlMessage)
      return this.receiveMessage(outOfBandMessage, config)
    } else if (parsedUrl['c_i'] || parsedUrl['d_m']) {
      const invitation = await ConnectionInvitationMessage.fromUrl(urlMessage)
      const { autoAcceptConnection } = config
      return this.connectionsModule.receiveInvitation(invitation, { autoAcceptConnection })
    }
    throw new AriesFrameworkError(
      'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`.'
    )
  }

  /**
   * Processes out-of-band message and passes all messages from `requests~attach` attribute to the agent.
   *
   * If the message contains `hanshake_protocols` attribute it either creates or reuse an existing connection.
   * It waits until the connection is ready and then it passes all messages from `requests~attach` attribute to the agent.
   * Reuse of connection can be enabled or disabled by `config.reuseConnection` attribute.
   *
   * If there is no `hanshake_protocols` attribute it just passes the messages to the agent.
   *
   * @param outOfBandMessage
   */
  public async receiveMessage(
    outOfBandMessage: OutOfBandMessage,
    config: ReceiveOutOfBandMessageConfig
  ): Promise<ConnectionRecord | undefined> {
    const { handshakeProtocols, services } = outOfBandMessage
    const { autoAcceptConnection, reuseConnection } = config
    const messages = outOfBandMessage.getRequests()

    if ((!handshakeProtocols || handshakeProtocols.length === 0) && (!messages || messages?.length === 0)) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    if (handshakeProtocols) {
      if (!this.areHandshakeProtocolsSupported(handshakeProtocols)) {
        const supportedProtocols = this.getSupportedHandshakeProtocols()
        throw new AriesFrameworkError(
          `Out-of-band message contains unsupported handshake protocols ${handshakeProtocols}. Supported protocols are ${supportedProtocols}`
        )
      }

      let connectionRecord: ConnectionRecord
      const existingConnection = await this.findExistingConnection(services)
      if (existingConnection) {
        this.logger.debug('Connection already exists.', { connectionId: existingConnection.id })
        if (reuseConnection) {
          this.logger.debug('Reuse is enabled. Reusing an existing connection.')
          connectionRecord = existingConnection
          if (!messages) {
            this.logger.debug('Out of band message does not contain any request messages.')
            await this.sendReuse(outOfBandMessage, connectionRecord)
          }
        } else {
          this.logger.debug('Reuse is disabled. Creating a new connection.')
          connectionRecord = await this.createConnection(outOfBandMessage, { autoAcceptConnection })
        }
      } else {
        this.logger.debug('Connection does not exists. Creating a new connection.')
        connectionRecord = await this.createConnection(outOfBandMessage, { autoAcceptConnection })
      }

      if (messages) {
        this.logger.debug('Out of band message contains request messages.')
        if (!connectionRecord.isReady) {
          // Wait until the connecion is ready and then pass the messages to the agent for further processing
          this.connectionsModule
            .returnWhenIsConnected(connectionRecord.id)
            .then((c) => {
              const connectionServices = c.theirDidDoc?.didCommServices
              this.emitMessages(connectionServices, messages)
            })
            .catch((error) => {
              if (error instanceof EmptyError) {
                this.logger.warn(
                  `Agent unsubscribed before connection got into ${ConnectionState.Complete} state`,
                  error
                )
              } else {
                this.logger.error('Promise waiting for the connection to be complete failed.', error)
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
    for (const service of services) {
      for (const recipientKey of service.recipientKeys) {
        // TODO Encode the key and endpoint of the service block in a Peer DID numalgo 2 and using that DID instead of a service block
        const existingConnection = await this.connectionsModule.findByTheirKey(recipientKey)
        return existingConnection
      }
    }
  }

  private async createConnection(outOfBandMessage: OutOfBandMessage, config: { autoAcceptConnection: boolean }) {
    const { services, label } = outOfBandMessage
    const { autoAcceptConnection } = config
    const invitation = new ConnectionInvitationMessage({
      label: label || '',
      ...services[0],
    })
    const connectionRecord = await this.connectionsModule.receiveInvitation(invitation, {
      autoAcceptConnection,
    })
    return connectionRecord
  }

  private emitMessages(services: DidCommService[] | undefined, messages: PlaintextMessage[]) {
    if (!services || services.length === 0) {
      throw new AriesFrameworkError(`There are no services. We can not emit messages`)
    }

    for (const plaintextMessage of messages) {
      // The framework currently supports only older OOB messages with `~service` decorator.
      const [service] = services
      plaintextMessage['~service'] = service

      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: plaintextMessage,
        },
      })
    }
  }

  private async sendReuse(outOfBandMessage: OutOfBandMessage, connection: ConnectionRecord) {
    const message = new HandshakeReuseMessage({ parentThreadId: outOfBandMessage.id })
    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new HandshakeReuseHandler())
  }
}
