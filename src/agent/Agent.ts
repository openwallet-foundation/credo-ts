import { EventEmitter } from 'events'
import { container as baseContainer, DependencyContainer } from 'tsyringe'

import { Logger } from '../logger'
import { InitConfig } from '../types'
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

export class Agent {
  public readonly agentConfig: AgentConfig
  protected logger: Logger
  protected container: DependencyContainer
  protected eventEmitter: EventEmitter
  protected wallet: Wallet
  protected messageReceiver: MessageReceiver
  protected messageSender: MessageSender
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
    this.eventEmitter = new EventEmitter()

    // Bind class based instances
    this.container.registerInstance(AgentConfig, this.agentConfig)
    this.container.registerInstance(EventEmitter, this.eventEmitter)

    // Based on interfaces. Need to register which class to use
    this.container.registerInstance(Symbols.Logger, this.logger)
    this.container.registerInstance(Symbols.Indy, this.agentConfig.indy)
    this.container.registerSingleton(Symbols.Wallet, IndyWallet)
    this.container.registerSingleton(Symbols.StorageService, IndyStorageService)

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
    this.messageSender = this.container.resolve(MessageSender)
    this.messageReceiver = this.container.resolve(MessageReceiver)
    this.wallet = this.container.resolve(Symbols.Wallet)

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
    this.eventEmitter.addListener('agentMessage', async (payload) => {
      await this.receiveMessage(payload)
    })
  }

  public setInboundTransporter(inboundTransporter: InboundTransporter) {
    this.inboundTransporter = inboundTransporter
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.messageSender.setOutboundTransporter(outboundTransporter)
  }

  public async init() {
    await this.wallet.init()

    const { publicDidSeed, genesisPath, poolName } = this.agentConfig
    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.wallet.initPublicDid({ seed: publicDidSeed })
    }

    // If the genesisPath is provided in the config, we will automatically handle ledger connection
    // otherwise the framework consumer needs to do this manually
    if (genesisPath) {
      await this.ledger.connect(poolName, {
        genesis_txn: genesisPath,
      })
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

  public async receiveMessage(inboundPackedMessage: unknown) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage)
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close()
    await this.wallet.delete()
  }
}
