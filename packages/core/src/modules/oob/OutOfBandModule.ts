import type { AgentMessage } from '../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../agent/Events'
import type { Logger } from '../../logger'
import type { ConnectionRecord, Routing, HandshakeProtocol } from '../../modules/connections'
import type { PlaintextMessage } from '../../types'

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

import { OutOfBandService } from './OutOfBandService'
import { OutOfBandRole } from './domain/OutOfBandRole'
import { OutOfBandState } from './domain/OutOfBandState'
import { HandshakeReuseHandler } from './handlers'
import { convertToNewInvitation } from './helpers'
import { OutOfBandMessage, HandshakeReuseMessage } from './messages'
import { OutOfBandRecord } from './repository/OutOfBandRecord'

const didCommProfiles = ['didcomm/aip1', 'didcomm/aip2;env=rfc19']

export interface CreateOutOfBandMessageConfig {
  label?: string
  alias?: string
  imageUrl?: string
  goalCode?: string
  goal?: string
  handshake?: boolean
  handshakeProtocols?: HandshakeProtocol[]
  messages?: AgentMessage[]
  multiUseInvitation?: boolean
  autoAcceptConnection?: boolean
  routing?: Routing
}

export interface ReceiveOutOfBandMessageConfig {
  label?: string
  alias?: string
  imageUrl?: string
  autoAcceptMessage?: boolean
  autoAcceptConnection?: boolean
  reuseConnection?: boolean
  routing?: Routing
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private outOfBandService: OutOfBandService
  private connectionsModule: ConnectionsModule
  private dids: DidsModule
  private dispatcher: Dispatcher
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig
  private logger: Logger

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    outOfBandService: OutOfBandService,
    connectionsModule: ConnectionsModule,
    dids: DidsModule,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.dispatcher = dispatcher
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.outOfBandService = outOfBandService
    this.connectionsModule = connectionsModule
    this.dids = dids
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
   * Agent role: sender (inviter)
   *
   * @param config Configuration and other attributes of out-of-band message
   * @param messages Messages that will be sent inside out-of-band message
   * @returns Out-of-band record and optionally connection record created based on `handshakeProtocol`
   */
  public async createInvitation(config: CreateOutOfBandMessageConfig = {}): Promise<OutOfBandRecord> {
    const multiUseInvitation = config.multiUseInvitation ?? false
    const handshake = config.handshake ?? true
    const customHandshakeProtocols = config.handshakeProtocols
    const autoAcceptConnection = config.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections
    const messages = config.messages
    const routing = config.routing
    const label = config.label ?? this.agentConfig.label
    const imageUrl = config.imageUrl ?? this.agentConfig.connectionImageUrl

    if (!handshake && !messages) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    if (!handshake && customHandshakeProtocols) {
      throw new AriesFrameworkError(`Attribute 'handshake' can not be 'false' when 'hansdhakeProtocols' is defined.`)
    }

    let handshakeProtocols
    if (handshake) {
      // Find first supported handshake protocol preserving the order of handshake protocols defined by agent
      if (customHandshakeProtocols) {
        this.assertHandshakeProtocols(customHandshakeProtocols)
        handshakeProtocols = customHandshakeProtocols
      } else {
        handshakeProtocols = this.getSupportedHandshakeProtocols()
      }
    }

    if (!routing) {
      throw new AriesFrameworkError('Something went wrong... Missing routing...')
    }

    const services = routing.endpoints.map((endpoint, index) => {
      return new DidCommService({
        id: `#inline-${index}`,
        priority: index,
        serviceEndpoint: endpoint,
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
    })

    const options = {
      label,
      imageUrl,
      accept: didCommProfiles,
      services,
      handshakeProtocols,
    }
    const outOfBandMessage = new OutOfBandMessage(options)

    if (messages) {
      messages.forEach((message) => {
        if (message.service) {
          // We can remove `~service` attribute from message. Newer OOB messages have `services` attribute instead.
          message.service = undefined
        }
        outOfBandMessage.addRequest(message)
      })
    }

    const outOfBandRecord = new OutOfBandRecord({
      role: OutOfBandRole.Sender,
      state: OutOfBandState.AwaitResponse,
      outOfBandMessage: outOfBandMessage,
      reusable: multiUseInvitation,
      autoAcceptConnection,
    })
    await this.outOfBandService.save(outOfBandRecord)

    return outOfBandRecord
  }

  /**
   * Parses URL, decodes invitation and calls `receiveMessage` with parsed invitation message.
   *
   * Agent role: receiver (invitee)
   *
   * @param invitationUrl url containing a base64 encoded invitation to receive
   * @param config config for handling of invitation
   * @returns OutOfBand record and connection record if one has been created.
   */
  public async receiveInvitationFromUrl(invitationUrl: string, config: ReceiveOutOfBandMessageConfig = {}) {
    const message = await this.parseInvitation(invitationUrl)
    return this.receiveInvitation(message, config)
  }

  /**
   * Parses URL containing encoded invitation and returns invitation message.
   *
   * @param invitationUrl URL containing encoded invitation
   *
   * @returns OutOfBandMessage
   */
  public async parseInvitation(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    if (parsedUrl['oob']) {
      const outOfBandMessage = await OutOfBandMessage.fromUrl(invitationUrl)
      return outOfBandMessage
    } else if (parsedUrl['c_i'] || parsedUrl['d_m']) {
      const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
      return convertToNewInvitation(invitation)
    }
    throw new AriesFrameworkError(
      'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`.'
    )
  }

  /**
   * Stores OutOfBand record with the invitation message. It automatically accepts the invitation
   * for further processing. If you don't want to do that you can set `autoAcceptMessage` to
   * `false`.
   *
   * If auto accepting is enabled via either the config passed in the function or the global agent
   * config, a connection request message will be send.
   *
   * If the message contains `hanshake_protocols` attribute it either creates or reuse an existing connection.
   * It waits until the connection is ready and then it passes all messages from `requests~attach` attribute to the agent.
   * Reuse of connection can be enabled or disabled by `config.reuseConnection` attribute.
   *
   * If there is no `hanshake_protocols` attribute it just passes the messages to the agent.
   *
   * It supports both OOB (Aries RFC 0434: Out-of-Band Protocol 1.1) and Connection Invitation (0160: Connection Protocol).
   *
   * @param outOfBandMessage
   * @param config config for handling of invitation
   *
   * @returns OutOfBand record and connection record if one has been created.
   */
  public async receiveInvitation(
    outOfBandMessage: OutOfBandMessage,
    config: ReceiveOutOfBandMessageConfig = {}
  ): Promise<{ outOfBandRecord: OutOfBandRecord; connectionRecord?: ConnectionRecord }> {
    const { handshakeProtocols } = outOfBandMessage
    const { routing } = config

    const autoAcceptMessage = config.autoAcceptMessage ?? true
    const autoAcceptConnection = config.autoAcceptConnection ?? true
    const reuseConnection = config.reuseConnection ?? false
    const label = config.label ?? this.agentConfig.label
    const alias = config.alias
    const imageUrl = config.imageUrl ?? this.agentConfig.connectionImageUrl

    const messages = outOfBandMessage.getRequests()

    if ((!handshakeProtocols || handshakeProtocols.length === 0) && (!messages || messages?.length === 0)) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
    }

    const outOfBandRecord = new OutOfBandRecord({
      role: OutOfBandRole.Receiver,
      state: OutOfBandState.PrepareResponse,
      outOfBandMessage: outOfBandMessage,
      autoAcceptConnection,
    })
    await this.outOfBandService.save(outOfBandRecord)

    if (autoAcceptMessage) {
      return await this.acceptInvitation(outOfBandRecord, {
        label,
        alias,
        imageUrl,
        autoAcceptConnection,
        reuseConnection,
        routing,
      })
    }

    return { outOfBandRecord }
  }

  public async acceptInvitation(
    outOfBandRecord: OutOfBandRecord,
    config: {
      autoAcceptConnection?: boolean
      reuseConnection?: boolean
      label?: string
      alias?: string
      imageUrl?: string
      mediatorId?: string
      routing?: Routing
    }
  ) {
    const { outOfBandMessage } = outOfBandRecord
    const { label, alias, imageUrl, autoAcceptConnection, reuseConnection, routing } = config
    const { handshakeProtocols, services } = outOfBandMessage
    const messages = outOfBandMessage.getRequests()

    const existingConnection = await this.findExistingConnection(services)

    if (handshakeProtocols) {
      this.logger.debug('Out of band message contains handshake protocols.')
      // Find first supported handshake protocol preserving the order of `handshake_protocols`
      // in out-of-band message.

      let connectionRecord
      if (existingConnection && reuseConnection) {
        this.logger.debug(`Reuse is enabled. Reusing an existing connection with ID ${existingConnection.id}.`)
        connectionRecord = existingConnection
        if (!messages) {
          this.logger.debug('Out of band message does not contain any request messages.')
          await this.sendReuse(outOfBandMessage, connectionRecord)
        }
      } else {
        this.logger.debug('Reuse is disabled or connection does not exist.')
        connectionRecord = await this.createConnection(outOfBandRecord, {
          label,
          alias,
          imageUrl,
          autoAcceptConnection,
          routing,
        })
      }

      if (messages) {
        this.logger.debug('Out of band message contains request messages.')
        if (connectionRecord.isReady) {
          await this.emitWithConnection(connectionRecord, messages)
        } else {
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
        }
      }
      return { outOfBandRecord, connectionRecord }
    } else if (messages) {
      this.logger.debug('Out of band message contains only request messages.')
      if (existingConnection) {
        this.logger.debug('Connection already exists.', { connectionId: existingConnection.id })
        await this.emitWithConnection(existingConnection, messages)
      } else {
        await this.emitWithServices(services, messages)
      }
    }
    return { outOfBandRecord }
  }

  public async findByRecipientKey(recipientKey: string) {
    return this.outOfBandService.findByRecipientKey(recipientKey)
  }

  public async findByMessageId(messageId: string) {
    return this.outOfBandService.findByMessageId(messageId)
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
    outOfBandRecord: OutOfBandRecord,
    config: { label?: string; alias?: string; imageUrl?: string; autoAcceptConnection?: boolean; routing?: Routing }
  ) {
    this.logger.debug('Creating a new connection.', { outOfBandRecord, config })
    const { outOfBandMessage } = outOfBandRecord
    const { handshakeProtocols } = outOfBandMessage
    const { label, alias, imageUrl, autoAcceptConnection, routing } = config

    if (!handshakeProtocols) {
      throw new AriesFrameworkError('Threre are no handshake protocols in out-of-band message')
    }

    const handshakeProtocol = this.getFirstSupportedProtocol(handshakeProtocols)
    const connectionRecord = await this.connectionsModule.acceptOutOfBandInvitation(outOfBandRecord, {
      label,
      alias,
      imageUrl,
      autoAcceptConnection,
      protocol: handshakeProtocol,
      routing,
    })

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
