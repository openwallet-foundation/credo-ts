import type { Logger } from '../logger'
import type { InboundTransport } from '../transport/InboundTransport'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { InitConfig } from '../types'
import type { Wallet } from '../wallet/Wallet'
import type { AgentDependencies } from './AgentDependencies'
import type { AgentMessageReceivedEvent } from './Events'
import type { TransportSession } from './TransportService'
import type { Subscription } from 'rxjs'
import type { DependencyContainer } from 'tsyringe'

import { concatMap, takeUntil } from 'rxjs/operators'
import { container as baseContainer } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { CredentialsModule } from '../modules/credentials/CredentialsModule'
import { DidsModule } from '../modules/dids/DidsModule'
import { DiscoverFeaturesModule } from '../modules/discover-features'
import { LedgerModule } from '../modules/ledger/LedgerModule'
import { OutOfBandModule } from '../modules/oob/OutOfBandModule'
import { ProofsModule } from '../modules/proofs/ProofsModule'
import { MediatorModule } from '../modules/routing/MediatorModule'
import { RecipientModule } from '../modules/routing/RecipientModule'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { IndyWallet } from '../wallet/IndyWallet'
import { WalletModule } from '../wallet/WalletModule'
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
  protected messageReceiver: MessageReceiver
  protected transportService: TransportService
  protected messageSender: MessageSender
  private _isInitialized = false
  public messageSubscription: Subscription
  private walletService: Wallet

  public readonly connections: ConnectionsModule
  public readonly proofs: ProofsModule
  public readonly basicMessages: BasicMessagesModule
  public readonly ledger: LedgerModule
  public readonly credentials: CredentialsModule
  public readonly mediationRecipient: RecipientModule
  public readonly mediator: MediatorModule
  public readonly discovery: DiscoverFeaturesModule
  public readonly dids: DidsModule
  public readonly wallet: WalletModule
  public readonly oob!: OutOfBandModule

  public constructor(initialConfig: InitConfig, dependencies: AgentDependencies) {
    // Create child container so we don't interfere with anything outside of this agent
    this.container = baseContainer.createChildContainer()

    this.agentConfig = new AgentConfig(initialConfig, dependencies)
    this.logger = this.agentConfig.logger

    // Bind class based instances
    this.container.registerInstance(AgentConfig, this.agentConfig)

    // Based on interfaces. Need to register which class to use
    this.container.registerInstance(InjectionSymbols.Logger, this.logger)
    this.container.register(InjectionSymbols.Wallet, { useToken: IndyWallet })
    this.container.registerSingleton(InjectionSymbols.StorageService, IndyStorageService)
    this.container.registerSingleton(InjectionSymbols.MessageRepository, InMemoryMessageRepository)

    this.logger.info('Creating agent with config', {
      ...initialConfig,
      // Prevent large object being logged.
      // Will display true/false to indicate if value is present in config
      logger: initialConfig.logger != undefined,
    })

    if (!this.agentConfig.walletConfig) {
      this.logger.warn(
        'Wallet config has not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    // Resolve instances after everything is registered
    this.eventEmitter = this.container.resolve(EventEmitter)
    this.messageSender = this.container.resolve(MessageSender)
    this.messageReceiver = this.container.resolve(MessageReceiver)
    this.transportService = this.container.resolve(TransportService)
    this.walletService = this.container.resolve(InjectionSymbols.Wallet)

    // We set the modules in the constructor because that allows to set them as read-only
    this.connections = this.container.resolve(ConnectionsModule)
    this.credentials = this.container.resolve(CredentialsModule)
    this.proofs = this.container.resolve(ProofsModule)
    this.mediator = this.container.resolve(MediatorModule)
    this.mediationRecipient = this.container.resolve(RecipientModule)
    this.basicMessages = this.container.resolve(BasicMessagesModule)
    this.ledger = this.container.resolve(LedgerModule)
    this.discovery = this.container.resolve(DiscoverFeaturesModule)
    this.dids = this.container.resolve(DidsModule)
    this.wallet = this.container.resolve(WalletModule)
    this.oob = this.container.resolve(OutOfBandModule)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(this.agentConfig.stop$),
        concatMap((e) => this.messageReceiver.receiveMessage(e.payload.message, { connection: e.payload.connection }))
      )
      .subscribe()
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this.messageReceiver.registerInboundTransport(inboundTransport)
  }

  public get inboundTransports() {
    return this.messageReceiver.inboundTransports
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.messageSender.registerOutboundTransport(outboundTransport)
  }

  public get outboundTransports() {
    return this.messageSender.outboundTransports
  }

  public get events() {
    return this.eventEmitter
  }

  public get isInitialized() {
    return this._isInitialized && this.wallet.isInitialized
  }

  public async initialize() {
    const { connectToIndyLedgersOnStartup, publicDidSeed, walletConfig, mediatorConnectionsInvite } = this.agentConfig

    if (this._isInitialized) {
      throw new AriesFrameworkError(
        'Agent already initialized. Currently it is not supported to re-initialize an already initialized agent.'
      )
    }

    if (!this.wallet.isInitialized && walletConfig) {
      await this.wallet.initialize(walletConfig)
    } else if (!this.wallet.isInitialized) {
      throw new WalletError(
        'Wallet config has not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.walletService.initPublicDid({ seed: publicDidSeed })
    }

    // As long as value isn't false we will async connect to all genesis pools on startup
    if (connectToIndyLedgersOnStartup) {
      this.ledger.connectToPools().catch((error) => {
        this.logger.warn('Error connecting to ledger, will try to reconnect when needed.', { error })
      })
    }

    // Start transports
    const allTransports = [...this.inboundTransports, ...this.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.start(this))
    await Promise.all(transportPromises)

    // Connect to mediator through provided invitation if provided in config
    // Also requests mediation ans sets as default mediator
    // Because this requires the connections module, we do this in the agent constructor
    if (mediatorConnectionsInvite) {
      this.logger.debug('Provision mediation with invitation', { mediatorConnectionsInvite })
      const mediatonConnection = await this.getMediationConnection(mediatorConnectionsInvite)
      await this.mediationRecipient.provision(mediatonConnection)
    }

    await this.mediationRecipient.initialize()

    this._isInitialized = true
  }

  public async shutdown() {
    // All observables use takeUntil with the stop$ observable
    // this means all observables will stop running if a value is emitted on this observable
    this.agentConfig.stop$.next(true)

    // Stop transports
    const allTransports = [...this.inboundTransports, ...this.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)

    // close wallet if still initialized
    if (this.wallet.isInitialized) {
      await this.wallet.close()
    }
    this._isInitialized = false
  }

  public get publicDid() {
    return this.walletService.publicDid
  }

  public async receiveMessage(inboundMessage: unknown, session?: TransportSession) {
    return await this.messageReceiver.receiveMessage(inboundMessage, { session })
  }

  public get injectionContainer() {
    return this.container
  }

  public get config() {
    return this.agentConfig
  }

  private async getMediationConnection(mediatorInvitationUrl: string) {
    const outOfBandMessage = await this.oob.parseInvitation(mediatorInvitationUrl)
    const outOfBandRecord = await this.oob.findByMessageId(outOfBandMessage.id)
    const connection = outOfBandRecord && (await this.connections.findByOutOfBandId(outOfBandRecord.id))

    if (!connection) {
      this.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await this.mediationRecipient.getRouting({ useDefaultMediator: false })

      this.logger.debug('Routing created', routing)
      const { connectionRecord: newConnection } = await this.oob.receiveInvitation(outOfBandMessage, {
        routing,
      })
      this.logger.debug(`Mediation invitation processed`, { outOfBandMessage })

      if (!newConnection) {
        throw new AriesFrameworkError('No connection record to provision mediation.')
      }

      return this.connections.returnWhenIsConnected(newConnection.id)
    }

    if (!connection.isReady) {
      return this.connections.returnWhenIsConnected(connection.id)
    }
    return connection
  }
}
