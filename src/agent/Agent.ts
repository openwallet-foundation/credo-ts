import { container as baseContainer, DependencyContainer } from 'tsyringe'

import { Logger } from '../logger'
import { InboundConnection, InitConfig } from '../types'
import { IndyWallet } from '../wallet/IndyWallet'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { InboundTransporter } from '../transport/InboundTransporter'
import { OutboundTransporter } from '../transport/OutboundTransporter'
import { MessageRepository } from '../storage/MessageRepository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { AgentConfig } from './AgentConfig'
import { Wallet } from '../wallet/Wallet'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { CredentialsModule } from '../modules/credentials/CredentialsModule'
import { ProofsModule } from '../modules/proofs/ProofsModule'
import { RoutingModule } from '../modules/routing/RoutingModule'
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule'
import { LedgerModule } from '../modules/ledger/LedgerModule'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { Symbols } from '../symbols'
import { Transport } from './TransportService'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes, AgentMessageReceivedEvent } from './Events'
import { MediationService } from '../modules/routing/services/MediationService'
import { ConnectionState } from '../modules/connections'

export class Agent {
  protected agentConfig: AgentConfig
  protected logger: Logger
  protected container: DependencyContainer
  protected eventEmitter: EventEmitter
  protected wallet: Wallet
  protected messageReceiver: MessageReceiver
  protected messageSender: MessageSender
  protected mediationService: MediationService
  public inboundTransporter?: InboundTransporter

  public readonly connections!: ConnectionsModule
  public readonly proofs!: ProofsModule
  public readonly routing!: RoutingModule
  public readonly basicMessages!: BasicMessagesModule
  public readonly ledger!: LedgerModule
  public readonly credentials!: CredentialsModule

  public constructor(initialConfig: InitConfig, messageRepository?: MessageRepository) {
    // Create child container so we don't interfere with anything outside of this agent
    this.container = baseContainer.createChildContainer()

    this.agentConfig = new AgentConfig(initialConfig)
    this.logger = this.agentConfig.logger

    // Bind class based instances
    this.container.registerInstance(AgentConfig, this.agentConfig)

    // Based on interfaces. Need to register which class to use
    this.container.registerInstance(Symbols.Logger, this.logger)
    this.container.registerInstance(Symbols.Indy, this.agentConfig.indy)
    this.container.register(Symbols.Wallet, { useToken: IndyWallet })
    this.container.registerSingleton(Symbols.StorageService, IndyStorageService)

    // File system differs based on NodeJS / React Native
    this.container.registerInstance(Symbols.FileSystem, this.agentConfig.fileSystem)

    // TODO: do not make messageRepository input parameter
    if (messageRepository) {
      this.container.registerInstance(Symbols.MessageRepository, messageRepository)
    } else {
      this.container.registerSingleton(Symbols.MessageRepository, InMemoryMessageRepository)
    }

    this.logger.info('Creating agent with config', {
      ...initialConfig,
      // Prevent large object being logged.
      // Will display true/false to indicate if value is present in config
      indy: initialConfig.indy != undefined,
      logger: initialConfig.logger != undefined,
    })

    // Resolve instances after everything is registered
    this.eventEmitter = this.container.resolve(EventEmitter)
    this.messageSender = this.container.resolve(MessageSender)
    this.messageReceiver = this.container.resolve(MessageReceiver)
    this.wallet = this.container.resolve(Symbols.Wallet)
    this.mediationService = this.container.resolve(MediationService)

    // We set the modules in the constructor because that allows to set them as read-only
    this.connections = this.container.resolve(ConnectionsModule)
    this.credentials = this.container.resolve(CredentialsModule)
    this.proofs = this.container.resolve(ProofsModule)
    this.routing = this.container.resolve(RoutingModule)
    this.basicMessages = this.container.resolve(BasicMessagesModule)
    this.ledger = this.container.resolve(LedgerModule)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    this.listenForMessages()
  }

  private listenForMessages() {
    this.eventEmitter.on<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived, async (event) => {
      await this.receiveMessage(event.payload.message)
    })
  }

  public setInboundTransporter(inboundTransporter: InboundTransporter) {
    this.inboundTransporter = inboundTransporter
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.messageSender.setOutboundTransporter(outboundTransporter)
  }

  public get outboundTransporter() {
    return this.messageSender.outboundTransporter
  }

  public get events() {
    return this.eventEmitter
  }

  public async init() {
    await this.wallet.init()

    const { publicDidSeed, mediatorRecordId } = this.agentConfig
    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.wallet.initPublicDid({ seed: publicDidSeed })

      // Init routing key for mediation service (server role)
      if (this.wallet.publicDid) {
        this.mediationService.setRoutingKey(this.wallet.publicDid.verkey)
      }
    }

    // If mediator record Id is provided, search for it and (if record exists) update other properties
    // accordingly, overriding them if needed
    if (mediatorRecordId) {
      const mediationRecord = await this.mediationService.findById(mediatorRecordId)
      if (mediationRecord) {
        const connectionRecord = await this.connections.findById(mediationRecord.connectionId)
        if (connectionRecord) {
          this.setInboundConnection({
            connection: connectionRecord,
            verkey: mediationRecord.routingKeys[0],
          })
        }
      }
    }

    if (this.inboundTransporter) {
      await this.inboundTransporter.start(this)
    }
  }

  public get publicDid() {
    return this.wallet.publicDid
  }

  public getMediatorUrl() {
    return this.agentConfig.mediatorUrl
  }

  public async receiveMessage(inboundPackedMessage: unknown, transport?: Transport) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage, transport)
  }

  public async setInboundConnection(inbound: InboundConnection) {
    inbound.connection.assertState(ConnectionState.Complete)

    this.agentConfig.establishInbound({
      verkey: inbound.verkey,
      connection: inbound.connection,
    })
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close()
    await this.wallet.delete()
  }

  public get injectionContainer() {
    return this.container
  }
}
