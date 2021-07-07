import type { Logger } from '../logger'
import type { MessageRepository } from '../storage/MessageRepository'
import type { InboundTransporter } from '../transport/InboundTransporter'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { InitConfig } from '../types'
import type { Wallet } from '../wallet/Wallet'
import type { AgentMessageReceivedEvent } from './Events'
import type { TransportSession } from './TransportService'
import type { Subscription } from 'rxjs'
import type { DependencyContainer } from 'tsyringe'

import { concatMap } from 'rxjs/operators'
import { container as baseContainer } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { CredentialsModule } from '../modules/credentials/CredentialsModule'
import { LedgerModule } from '../modules/ledger/LedgerModule'
import { ProofsModule } from '../modules/proofs/ProofsModule'
import { RoutingModule } from '../modules/routing/RoutingModule'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { IndyWallet } from '../wallet/IndyWallet'
import { WalletError } from '../wallet/error'

import { AgentConfig } from './AgentConfig'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'

export class Agent {
  protected agentConfig: AgentConfig
  protected logger: Logger
  protected container: DependencyContainer
  protected eventEmitter: EventEmitter
  protected wallet: Wallet
  protected messageReceiver: MessageReceiver
  protected transportService: TransportService
  protected messageSender: MessageSender
  public inboundTransporter?: InboundTransporter
  private _isInitialized = false
  public messageSubscription: Subscription

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
    this.container.registerInstance(InjectionSymbols.Logger, this.logger)
    this.container.registerInstance(InjectionSymbols.Indy, this.agentConfig.indy)
    this.container.register(InjectionSymbols.Wallet, { useToken: IndyWallet })
    this.container.registerSingleton(InjectionSymbols.StorageService, IndyStorageService)

    // File system differs based on NodeJS / React Native
    this.container.registerInstance(InjectionSymbols.FileSystem, this.agentConfig.fileSystem)

    // TODO: do not make messageRepository input parameter
    if (messageRepository) {
      this.container.registerInstance(InjectionSymbols.MessageRepository, messageRepository)
    } else {
      this.container.registerSingleton(InjectionSymbols.MessageRepository, InMemoryMessageRepository)
    }

    this.logger.info('Creating agent with config', {
      ...initialConfig,
      // Prevent large object being logged.
      // Will display true/false to indicate if value is present in config
      indy: initialConfig.indy != undefined,
      logger: initialConfig.logger != undefined,
    })

    if (!this.agentConfig.walletConfig || !this.agentConfig.walletCredentials) {
      this.logger.warn(
        'Wallet config and/or credentials have not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    // Resolve instances after everything is registered
    this.eventEmitter = this.container.resolve(EventEmitter)
    this.messageSender = this.container.resolve(MessageSender)
    this.messageReceiver = this.container.resolve(MessageReceiver)
    this.transportService = this.container.resolve(TransportService)
    this.wallet = this.container.resolve(InjectionSymbols.Wallet)

    // We set the modules in the constructor because that allows to set them as read-only
    this.connections = this.container.resolve(ConnectionsModule)
    this.credentials = this.container.resolve(CredentialsModule)
    this.proofs = this.container.resolve(ProofsModule)
    this.routing = this.container.resolve(RoutingModule)
    this.basicMessages = this.container.resolve(BasicMessagesModule)
    this.ledger = this.container.resolve(LedgerModule)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(concatMap((e) => this.messageReceiver.receiveMessage(e.payload.message)))
      .subscribe()
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

  public get isInitialized() {
    return this._isInitialized && this.wallet.isInitialized
  }

  public async initialize() {
    const { publicDidSeed, walletConfig, walletCredentials } = this.agentConfig

    if (this._isInitialized) {
      throw new AriesFrameworkError(
        'Agent already initialized. Currently it is not supported to re-initialize an already initialized agent.'
      )
    }

    if (!this.wallet.isInitialized && walletConfig && walletCredentials) {
      await this.wallet.initialize(walletConfig, walletCredentials)
    } else if (!this.wallet.isInitialized) {
      throw new WalletError(
        'Wallet config and/or credentials have not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.wallet.initPublicDid({ seed: publicDidSeed })
    }

    if (this.inboundTransporter) {
      await this.inboundTransporter.start(this)
    }

    this._isInitialized = true
  }

  public get publicDid() {
    return this.wallet.publicDid
  }

  public getMediatorUrl() {
    return this.agentConfig.mediatorUrl
  }

  public async receiveMessage(inboundPackedMessage: unknown, session?: TransportSession) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage, session)
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close()
    await this.wallet.delete()
  }

  public removeSession(session: TransportSession) {
    this.transportService.removeSession(session)
  }

  public get injectionContainer() {
    return this.container
  }
}
