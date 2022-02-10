import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { Logger } from '../../logger'
import type { PlaintextMessage } from '../../types'
import type { ConnectionRecord, HandshakeProtocol } from '../connections'

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
import { ConnectionInvitationMessage, ConnectionState, ConnectionsModule } from '../connections'
import { DidCommService, DidsModule } from '../dids'
import { MediationRecipientService } from '../routing'

import { HandshakeReuseHandler } from './handlers'
import { OutOfBandMessage, HandshakeReuseMessage } from './messages'

export interface CreateOutOfBandMessageConfig {
  label: string
  goalCode?: string
  goal?: string
  handshake: boolean
  handshakeProtocols?: HandshakeProtocol[]
  messages?: AgentMessage[]
  multiUseInvitation?: boolean
}

export interface ReceiveOutOfBandMessageConfig {
  autoAcceptConnection: boolean
  reuseConnection?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionsModule: ConnectionsModule
  private dids: DidsModule
  private mediationRecipientService: MediationRecipientService
  private dispatcher: Dispatcher
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionsModule: ConnectionsModule,
    dids: DidsModule,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.dispatcher = dispatcher
    this.logger = agentConfig.logger
    this.connectionsModule = connectionsModule
    this.dids = dids
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  /**
   * Creates an out-of-band message and adds given agent messages to `requests~attach` attribute.
   *
   * If you want to create a new connection you need to set `handshake` to `true`. You can define
   * what patricular handshakre protocols should be used by setting `handshakeProtocols` to one or
   * more supported protocols from `HandhsakeProtocol`, for example:
   *
   * ```ts
   *  const config = {
   *    handshake: true
   *    handshakeProtocols: [HandshakeProtocol.DidExchange]
   *  }
   *  const message = outOfBandModule.createMessage(config)
   * ```
   *
   * Then, the out-of-band will use its keys and will work as a connection invitation.
   *
   * @param config Configuration and other attributes of out-of-band message
   * @param messages Messages that will be sent inside out-of-band message
   * @returns Out-of-band message and optionally connection record created based on `handshakeProtocol`
   */
  public async createMessage(
    config: CreateOutOfBandMessageConfig
  ): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord?: ConnectionRecord }> {
    const { label, multiUseInvitation, handshake, handshakeProtocols: customHandshakeProtocols, messages } = config
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
      let handshakeProtocols
      // Find first supported handshake protocol preserving the order of handshake protocols defined by agent
      if (customHandshakeProtocols) {
        this.assertHandshakeProtocols(customHandshakeProtocols)
        handshakeProtocols = customHandshakeProtocols
      } else {
        handshakeProtocols = this.getSupportedHandshakeProtocols()
      }

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

      const options = {
        ...config,
        id: connectionRecord.invitation?.id,
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

    const existingConnection = await this.findExistingConnection(services)

    if (handshakeProtocols) {
      this.logger.debug('Out of band message contains handshake protocols.')
      // Find first supported handshake protocol preserving the order of `handshake_protocols`
      // in out-of-band message.
      const handshakeProtocol = this.getFirstSupportedProtocol(handshakeProtocols)

      let connectionRecord: ConnectionRecord
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
          this.logger.debug('Reuse is disabled.')
          connectionRecord = await this.createConnection(outOfBandMessage, { handshakeProtocol, autoAcceptConnection })
        }
      } else {
        this.logger.debug('Connection does not exists.')
        connectionRecord = await this.createConnection(outOfBandMessage, { handshakeProtocol, autoAcceptConnection })
      }

      if (messages) {
        this.logger.debug('Out of band message contains request messages.')
        if (!connectionRecord.isReady) {
          // Wait until the connecion is ready and then pass the messages to the agent for further processing
          this.connectionsModule
            .returnWhenIsConnected(connectionRecord.id)
            .then((connectionRecord) => this.emitWithConnection(connectionRecord, messages))
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
          await this.emitWithConnection(connectionRecord, messages)
        }
      }

      return connectionRecord
    } else if (messages) {
      this.logger.debug('Out of band message contains only request messages.')
      if (existingConnection) {
        this.logger.debug('Connection already exists.', { connectionId: existingConnection.id })
        await this.emitWithConnection(existingConnection, messages)
      } else {
        await this.emitWithServices(services, messages)
      }
    }
  }

  private assertHandshakeProtocols(handshakeProtocols: HandshakeProtocol[]) {
    if (!this.areHandshakeProtocolsSupported(handshakeProtocols)) {
      const supportedProtocols = this.getSupportedHandshakeProtocols()
      throw new AriesFrameworkError(
        `Handshake protocols [${handshakeProtocols}] are not supported. Supported protocols are [${supportedProtocols}]`
      )
    }
  }

  private areHandshakeProtocolsSupported(handshakeProtocols: HandshakeProtocol[]) {
    const supportedProtocols = this.getSupportedHandshakeProtocols()
    return handshakeProtocols.every((p) => supportedProtocols.includes(p))
  }

  private getSupportedHandshakeProtocols(): HandshakeProtocol[] {
    const handshakeMessageFamilies = ['https://didcomm.org/didexchange', 'https://didcomm.org/connections']
    const handshakeProtocols = this.dispatcher.filterSupportedProtocolsByMessageFamilies(handshakeMessageFamilies)

    if (handshakeProtocols.length === 0) {
      throw new AriesFrameworkError('There is no handshake protocol supported. Agent can not create a connection.')
    }

    // Order protocols according to `handshakeMessageFamilies` array
    const orederedProtocols = handshakeMessageFamilies
      .map((messageFamily) => handshakeProtocols.find((p) => p.startsWith(messageFamily)))
      .filter((item): item is string => !!item)

    return orederedProtocols as HandshakeProtocol[]
  }

  private getFirstSupportedProtocol(handshakeProtocols: HandshakeProtocol[]) {
    const supportedProtocols = this.getSupportedHandshakeProtocols()
    const handshakeProtocol = handshakeProtocols.find((p) => supportedProtocols.includes(p))
    if (!handshakeProtocol) {
      throw new AriesFrameworkError(
        `Handshake protocols [${handshakeProtocols}] are not supported. Supported protocols are [${supportedProtocols}]`
      )
    }
    return handshakeProtocol
  }

  private async findExistingConnection(services: Array<DidCommService | string>) {
    this.logger.debug('Searching for an existing connection for given services.', { services })
    for (const service of services) {
      if (typeof service === 'string') {
        // TODO await this.connectionsModule.findByTheirDid()
        throw new AriesFrameworkError('Dids are not currently supported in out-of-band message services attribute.')
      }

      for (const recipientKey of service.recipientKeys) {
        let existingConnection = await this.connectionsModule.findByTheirKey(recipientKey)

        if (!existingConnection) {
          // TODO Encode the key and endpoint of the service block in a Peer DID numalgo 2 and using that DID instead of a service block
          const theirDidRecord = await this.dids.findByVerkey(recipientKey)

          if (theirDidRecord) {
            existingConnection = await this.connectionsModule.findByDid(theirDidRecord.id)
          }
        }

        return existingConnection
      }
    }
  }

  private async createConnection(
    outOfBandMessage: OutOfBandMessage,
    config: { handshakeProtocol: HandshakeProtocol; autoAcceptConnection: boolean }
  ) {
    this.logger.debug('Creating a new connection.', { outOfBandMessage, config })
    const { services, label } = outOfBandMessage
    const { handshakeProtocol, autoAcceptConnection } = config

    if (services.length > 1) {
      throw new AriesFrameworkError(`Agent currently does not support more than one item in 'service' attribute.`)
    }

    const [service] = services
    let options
    if (typeof service === 'string') {
      options = {
        did: service,
      }
    } else {
      options = {
        recipientKeys: service.recipientKeys,
        serviceEndpoint: service.serviceEndpoint,
        routingKeys: service.routingKeys,
      }
    }

    const invitation = new ConnectionInvitationMessage({ id: outOfBandMessage.id, label, ...options })
    const connectionRecord = await this.connectionsModule.receiveInvitation(invitation, {
      autoAcceptConnection,
      protocol: handshakeProtocol,
    })
    this.logger.debug('Connection created.', connectionRecord)
    return connectionRecord
  }

  private async emitWithConnection(connectionRecord: ConnectionRecord, messages: PlaintextMessage[]) {
    const plaintextMessage = messages.find((message) =>
      this.dispatcher.supportedMessageTypes.find((type) => type === message['@type'])
    )

    if (!plaintextMessage) {
      throw new AriesFrameworkError('There is no message in requests~attach supported by agent.')
    }

    this.logger.debug(`Message with type ${plaintextMessage['@type']} can be processed.`)

    this.eventEmitter.emit<AgentMessageReceivedEvent>({
      type: AgentEventTypes.AgentMessageReceived,
      payload: {
        message: plaintextMessage,
        connection: connectionRecord,
      },
    })
  }

  private async emitWithServices(services: Array<DidCommService | string>, messages: PlaintextMessage[]) {
    if (!services || services.length === 0) {
      throw new AriesFrameworkError(`There are no services. We can not emit messages`)
    }

    const plaintextMessage = messages.find((message) =>
      this.dispatcher.supportedMessageTypes.find((type) => type === message['@type'])
    )

    if (!plaintextMessage) {
      throw new AriesFrameworkError('There is no message in requests~attach supported by agent.')
    }

    this.logger.debug(`Message with type ${plaintextMessage['@type']} can be processed.`)

    // The framework currently supports only older OOB messages with `~service` decorator.
    const [service] = services

    if (typeof service === 'string') {
      throw new AriesFrameworkError('Dids are not currently supported in out-of-band message services attribute.')
    }

    plaintextMessage['~service'] = service
    this.eventEmitter.emit<AgentMessageReceivedEvent>({
      type: AgentEventTypes.AgentMessageReceived,
      payload: {
        message: plaintextMessage,
      },
    })
  }

  private async sendReuse(outOfBandMessage: OutOfBandMessage, connection: ConnectionRecord) {
    const message = new HandshakeReuseMessage({ parentThreadId: outOfBandMessage.id })
    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new HandshakeReuseHandler(this.logger))
  }
}
