import type { Logger } from '../logger'
import type { InboundTransport } from '../transport/InboundTransport'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { InitConfig } from '../types'
import type { AgentDependencies } from './AgentDependencies'
import type { AgentMessageReceivedEvent } from './Events'
import type { TransportSession } from './TransportService'
import type { Subscription } from 'rxjs'
import type { DependencyContainer } from 'tsyringe'

import { Subject } from 'rxjs'
import { concatMap, takeUntil } from 'rxjs/operators'
import { container as baseContainer } from 'tsyringe'

import { CacheRepository } from '../cache'
import { InjectionSymbols } from '../constants'
import { JwsService } from '../crypto/JwsService'
import { AriesFrameworkError } from '../error'
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { CredentialsModule } from '../modules/credentials/CredentialsModule'
import { DidsModule } from '../modules/dids/DidsModule'
import { DiscoverFeaturesModule } from '../modules/discover-features'
import { GenericRecordsModule } from '../modules/generic-records/GenericRecordsModule'
import { IndyModule } from '../modules/indy/module'
import { LedgerModule } from '../modules/ledger/LedgerModule'
import { OutOfBandModule } from '../modules/oob/OutOfBandModule'
import { ProofsModule } from '../modules/proofs/ProofsModule'
import { QuestionAnswerModule } from '../modules/question-answer/QuestionAnswerModule'
import { MediatorModule } from '../modules/routing/MediatorModule'
import { RecipientModule } from '../modules/routing/RecipientModule'
import { RoutingService } from '../modules/routing/services/RoutingService'
import { DependencyManager } from '../plugins'
import { StorageUpdateService, DidCommMessageRepository, StorageVersionRepository } from '../storage'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { UpdateAssistant } from '../storage/migration/UpdateAssistant'
import { DEFAULT_UPDATE_CONFIG } from '../storage/migration/updates'
import { IndyWallet } from '../wallet/IndyWallet'
import { WalletModule } from '../wallet/WalletModule'
import { WalletError } from '../wallet/error'

import { AgentConfig } from './AgentConfig'
import { AgentContext } from './AgentContext'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'

export class Agent {
  protected agentConfig: AgentConfig
  protected logger: Logger
  public readonly dependencyManager: DependencyManager
  protected eventEmitter: EventEmitter
  protected messageReceiver: MessageReceiver
  protected transportService: TransportService
  protected messageSender: MessageSender
  private _isInitialized = false
  public messageSubscription: Subscription
  private routingService: RoutingService
  private agentContext: AgentContext
  private stop$ = new Subject<boolean>()

  public readonly connections: ConnectionsModule
  public readonly proofs: ProofsModule
  public readonly basicMessages: BasicMessagesModule
  public readonly genericRecords: GenericRecordsModule
  public readonly ledger: LedgerModule
  public readonly questionAnswer!: QuestionAnswerModule
  public readonly credentials: CredentialsModule
  public readonly mediationRecipient: RecipientModule
  public readonly mediator: MediatorModule
  public readonly discovery: DiscoverFeaturesModule
  public readonly dids: DidsModule
  public readonly wallet: WalletModule
  public readonly oob!: OutOfBandModule

  public constructor(
    initialConfig: InitConfig,
    dependencies: AgentDependencies,
    injectionContainer?: DependencyContainer
  ) {
    // Take input container or child container so we don't interfere with anything outside of this agent
    const container = injectionContainer ?? baseContainer.createChildContainer()

    this.dependencyManager = new DependencyManager(container)

    this.agentConfig = new AgentConfig(initialConfig, dependencies)
    this.logger = this.agentConfig.logger

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

    this.registerDependencies(this.dependencyManager)

    // Resolve instances after everything is registered
    this.eventEmitter = this.dependencyManager.resolve(EventEmitter)
    this.messageSender = this.dependencyManager.resolve(MessageSender)
    this.messageReceiver = this.dependencyManager.resolve(MessageReceiver)
    this.transportService = this.dependencyManager.resolve(TransportService)
    this.routingService = this.dependencyManager.resolve(RoutingService)
    this.agentContext = this.dependencyManager.resolve(AgentContext)

    // We set the modules in the constructor because that allows to set them as read-only
    this.connections = this.dependencyManager.resolve(ConnectionsModule)
    this.credentials = this.dependencyManager.resolve(CredentialsModule) as CredentialsModule
    this.proofs = this.dependencyManager.resolve(ProofsModule)
    this.mediator = this.dependencyManager.resolve(MediatorModule)
    this.mediationRecipient = this.dependencyManager.resolve(RecipientModule)
    this.basicMessages = this.dependencyManager.resolve(BasicMessagesModule)
    this.questionAnswer = this.dependencyManager.resolve(QuestionAnswerModule)
    this.genericRecords = this.dependencyManager.resolve(GenericRecordsModule)
    this.ledger = this.dependencyManager.resolve(LedgerModule)
    this.discovery = this.dependencyManager.resolve(DiscoverFeaturesModule)
    this.dids = this.dependencyManager.resolve(DidsModule)
    this.wallet = this.dependencyManager.resolve(WalletModule)
    this.oob = this.dependencyManager.resolve(OutOfBandModule)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(this.stop$),
        concatMap((e) =>
          this.messageReceiver.receiveMessage(this.agentContext, e.payload.message, {
            connection: e.payload.connection,
          })
        )
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

    // Make sure the storage is up to date
    const storageUpdateService = this.dependencyManager.resolve(StorageUpdateService)
    const isStorageUpToDate = await storageUpdateService.isUpToDate(this.agentContext)
    this.logger.info(`Agent storage is ${isStorageUpToDate ? '' : 'not '}up to date.`)

    if (!isStorageUpToDate && this.agentConfig.autoUpdateStorageOnStartup) {
      const updateAssistant = new UpdateAssistant(this, DEFAULT_UPDATE_CONFIG)

      await updateAssistant.initialize()
      await updateAssistant.update()
    } else if (!isStorageUpToDate) {
      const currentVersion = await storageUpdateService.getCurrentStorageVersion(this.agentContext)
      // Close wallet to prevent un-initialized agent with initialized wallet
      await this.wallet.close()
      throw new AriesFrameworkError(
        // TODO: add link to where documentation on how to update can be found.
        `Current agent storage is not up to date. ` +
          `To prevent the framework state from getting corrupted the agent initialization is aborted. ` +
          `Make sure to update the agent storage (currently at ${currentVersion}) to the latest version (${UpdateAssistant.frameworkStorageVersion}). ` +
          `You can also downgrade your version of Aries Framework JavaScript.`
      )
    }

    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.agentContext.wallet.initPublicDid({ seed: publicDidSeed })
    }

    // set the pools on the ledger.
    this.ledger.setPools(this.agentContext.config.indyLedgers)
    // As long as value isn't false we will async connect to all genesis pools on startup
    if (connectToIndyLedgersOnStartup) {
      this.ledger.connectToPools().catch((error) => {
        this.logger.warn('Error connecting to ledger, will try to reconnect when needed.', { error })
      })
    }

    for (const transport of this.inboundTransports) {
      await transport.start(this)
    }

    for (const transport of this.outboundTransports) {
      await transport.start(this)
    }

    // Connect to mediator through provided invitation if provided in config
    // Also requests mediation ans sets as default mediator
    // Because this requires the connections module, we do this in the agent constructor
    if (mediatorConnectionsInvite) {
      this.logger.debug('Provision mediation with invitation', { mediatorConnectionsInvite })
      const mediationConnection = await this.getMediationConnection(mediatorConnectionsInvite)
      await this.mediationRecipient.provision(mediationConnection)
    }

    await this.mediationRecipient.initialize()

    this._isInitialized = true
  }

  public async shutdown() {
    // All observables use takeUntil with the stop$ observable
    // this means all observables will stop running if a value is emitted on this observable
    this.stop$.next(true)

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
    return this.agentContext.wallet.publicDid
  }

  public async receiveMessage(inboundMessage: unknown, session?: TransportSession) {
    return await this.messageReceiver.receiveMessage(this.agentContext, inboundMessage, { session })
  }

  public get injectionContainer() {
    return this.dependencyManager.container
  }

  public get config() {
    return this.agentConfig
  }

  public get context() {
    return this.agentContext
  }

  private async getMediationConnection(mediatorInvitationUrl: string) {
    const outOfBandInvitation = this.oob.parseInvitation(mediatorInvitationUrl)
    const outOfBandRecord = await this.oob.findByInvitationId(outOfBandInvitation.id)
    const [connection] = outOfBandRecord ? await this.connections.findAllByOutOfBandId(outOfBandRecord.id) : []

    if (!connection) {
      this.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await this.routingService.getRouting(this.agentContext, { useDefaultMediator: false })

      this.logger.debug('Routing created', routing)
      const { connectionRecord: newConnection } = await this.oob.receiveInvitation(outOfBandInvitation, {
        routing,
      })
      this.logger.debug(`Mediation invitation processed`, { outOfBandInvitation })

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

  private registerDependencies(dependencyManager: DependencyManager) {
    const dependencies = this.agentConfig.agentDependencies

    // Register internal dependencies
    dependencyManager.registerSingleton(EventEmitter)
    dependencyManager.registerSingleton(MessageSender)
    dependencyManager.registerSingleton(MessageReceiver)
    dependencyManager.registerSingleton(TransportService)
    dependencyManager.registerSingleton(Dispatcher)
    dependencyManager.registerSingleton(EnvelopeService)
    dependencyManager.registerSingleton(JwsService)
    dependencyManager.registerSingleton(CacheRepository)
    dependencyManager.registerSingleton(DidCommMessageRepository)
    dependencyManager.registerSingleton(StorageVersionRepository)
    dependencyManager.registerSingleton(StorageUpdateService)

    dependencyManager.registerInstance(AgentConfig, this.agentConfig)
    dependencyManager.registerInstance(InjectionSymbols.AgentDependencies, dependencies)
    dependencyManager.registerInstance(InjectionSymbols.FileSystem, new dependencies.FileSystem())
    dependencyManager.registerInstance(InjectionSymbols.Stop$, this.stop$)

    // Register possibly already defined services
    if (!dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndyWallet)
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.Logger)) {
      dependencyManager.registerInstance(InjectionSymbols.Logger, this.logger)
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      dependencyManager.registerSingleton(InjectionSymbols.StorageService, IndyStorageService)
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.MessageRepository)) {
      dependencyManager.registerSingleton(InjectionSymbols.MessageRepository, InMemoryMessageRepository)
    }

    // Register all modules
    dependencyManager.registerModules(
      ConnectionsModule,
      CredentialsModule,
      ProofsModule,
      MediatorModule,
      RecipientModule,
      BasicMessagesModule,
      QuestionAnswerModule,
      GenericRecordsModule,
      LedgerModule,
      DiscoverFeaturesModule,
      DidsModule,
      WalletModule,
      OutOfBandModule,
      IndyModule
    )

    dependencyManager.registerInstance(AgentContext, new AgentContext({ dependencyManager }))
  }
}
