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

import { OutOfBandService } from './OutOfBandService'
import { OutOfBandRole } from './domain/OutOfBandRole'
import { OutOfBandState } from './domain/OutOfBandState'
import { HandshakeReuseHandler } from './handlers'
import { OutOfBandMessage, HandshakeReuseMessage } from './messages'
import { OutOfBandRecord } from './repository/OutOfBandRecord'

// TODO
// 1. routing keys,
// 2. out-of-band record (we can do in two steps, 1. use it with oob and DID Exchange, 2. use it also for the Connection protocol)
// 3. roles and states,
// 4. get rid of did doc and verkey

const didCommProfiles = ['didcomm/aip1', 'didcomm/aip2;env=rfc19']

export interface CreateOutOfBandMessageConfig {
  label: string
  goalCode?: string
  goal?: string
  handshake: boolean
  handshakeProtocols?: HandshakeProtocol[]
  messages?: AgentMessage[]
  multiUseInvitation?: boolean
  autoAcceptConnection?: boolean
}

export interface ReceiveOutOfBandMessageConfig {
  autoAcceptMessage: boolean
  autoAcceptConnection: boolean
  reuseConnection?: boolean
  label?: string
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private outOfBandService: OutOfBandService
  private connectionsModule: ConnectionsModule
  private dids: DidsModule
  private mediationRecipientService: MediationRecipientService
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
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.dispatcher = dispatcher
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.outOfBandService = outOfBandService
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
  public async createMessage(config: CreateOutOfBandMessageConfig): Promise<OutOfBandRecord> {
    const {
      label,
      multiUseInvitation,
      handshake,
      handshakeProtocols: customHandshakeProtocols,
      autoAcceptConnection,
      messages,
    } = config
    if (!handshake && !messages) {
      throw new AriesFrameworkError(
        'One or both of handshake_protocols and requests~attach MUST be included in the message.'
      )
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

    // create did, verkey
    // update mediation
    // create service
    const routing = await this.mediationRecipientService.getRouting()
    const service = new DidCommService({
      id: '#inline',
      priority: 0,
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })
    const options = {
      label,
      accept: didCommProfiles,
      services: [service],
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
      state: OutOfBandState.Initial,
      outOfBandMessage: outOfBandMessage,
      reusable: multiUseInvitation,
      autoAcceptConnection: autoAcceptConnection ?? this.agentConfig.autoAcceptConnections,
    })
    await this.outOfBandService.save(outOfBandRecord)

    return outOfBandRecord
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
      const connectionRecord = await this.connectionsModule.receiveInvitation(invitation, { autoAcceptConnection })
      return { connectionRecord }
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
  ): Promise<{ outOfBandRecord: OutOfBandRecord; connectionRecord?: ConnectionRecord }> {
    const { handshakeProtocols } = outOfBandMessage
    const { autoAcceptMessage, autoAcceptConnection, reuseConnection, label } = config
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
      autoAcceptConnection: autoAcceptConnection ?? this.agentConfig.autoAcceptConnections,
    })
    await this.outOfBandService.save(outOfBandRecord)

    if (autoAcceptMessage) {
      return await this.acceptMessage(outOfBandRecord, { label, autoAcceptConnection, reuseConnection })
    }

    return { outOfBandRecord }
  }

  public async acceptMessage(
    outOfBandRecord: OutOfBandRecord,
    config: {
      autoAcceptConnection?: boolean
      reuseConnection?: boolean
      label?: string
      mediatorId?: string
    }
  ) {
    const { outOfBandMessage } = outOfBandRecord
    const { label, autoAcceptConnection, reuseConnection } = config
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
          autoAcceptConnection,
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
    config: { label?: string; autoAcceptConnection?: boolean }
  ) {
    this.logger.debug('Creating a new connection.', { outOfBandRecord, config })
    const { outOfBandMessage } = outOfBandRecord
    const { handshakeProtocols } = outOfBandMessage
    const { label, autoAcceptConnection } = config

    if (!handshakeProtocols) {
      throw new AriesFrameworkError('Threre are no handshake protocols in out-of-band message')
    }

    const handshakeProtocol = this.getFirstSupportedProtocol(handshakeProtocols)
    const connectionRecord = await this.connectionsModule.acceptOutOfBandInvitation(outOfBandRecord, {
      label,
      autoAcceptConnection,
      protocol: handshakeProtocol,
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
