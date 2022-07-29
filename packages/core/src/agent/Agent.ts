import type { InboundTransport } from '../transport/InboundTransport'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { InitConfig } from '../types'
import type { AgentDependencies } from './AgentDependencies'
import type { AgentMessageReceivedEvent } from './Events'
import type { Subscription } from 'rxjs'

import { Subject } from 'rxjs'
import { concatMap, takeUntil } from 'rxjs/operators'

import { CacheRepository } from '../cache'
import { InjectionSymbols } from '../constants'
import { JwsService } from '../crypto/JwsService'
import { AriesFrameworkError } from '../error'
import { BasicMessagesModule } from '../modules/basic-messages'
import { ConnectionsModule } from '../modules/connections'
import { CredentialsModule } from '../modules/credentials'
import { DidsModule } from '../modules/dids'
import { DiscoverFeaturesModule } from '../modules/discover-features'
import { GenericRecordsModule } from '../modules/generic-records'
import { IndyModule } from '../modules/indy'
import { LedgerModule } from '../modules/ledger'
import { OutOfBandModule } from '../modules/oob'
import { ProofsModule } from '../modules/proofs'
import { QuestionAnswerModule } from '../modules/question-answer'
import { MediatorModule, RecipientModule } from '../modules/routing'
import { W3cVcModule } from '../modules/vc'
import { DependencyManager } from '../plugins'
import { DidCommMessageRepository, StorageUpdateService, StorageVersionRepository } from '../storage'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { WalletModule } from '../wallet'
import { IndyWallet } from '../wallet/IndyWallet'

import { AgentConfig } from './AgentConfig'
import { BaseAgent } from './BaseAgent'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContext, DefaultAgentContextProvider } from './context'

export class Agent extends BaseAgent {
  public messageSubscription: Subscription

  public constructor(
    initialConfig: InitConfig,
    dependencies: AgentDependencies,
    dependencyManager?: DependencyManager
  ) {
    // NOTE: we can't create variables before calling super as TS will complain that the super call must be the
    // the first statement in the constructor.
    super(new AgentConfig(initialConfig, dependencies), dependencyManager ?? new DependencyManager())

    const stop$ = this.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(stop$),
        concatMap((e) =>
          this.messageReceiver.receiveMessage(e.payload.message, {
            connection: e.payload.connection,
            contextCorrelationId: e.payload.contextCorrelationId,
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

  public async initialize() {
    await super.initialize()

    // set the pools on the ledger.
    this.ledger.setPools(this.ledger.config.indyLedgers)
    // As long as value isn't false we will async connect to all genesis pools on startup
    if (this.ledger.config.connectToLedgersOnStartup) {
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
    if (this.mediationRecipient.config.mediatorInvitationUrl) {
      this.logger.debug('Provision mediation with invitation', {
        mediatorInvitationUrl: this.mediationRecipient.config.mediatorInvitationUrl,
      })
      const mediationConnection = await this.getMediationConnection(
        this.mediationRecipient.config.mediatorInvitationUrl
      )
      await this.mediationRecipient.provision(mediationConnection)
    }

    await this.mediationRecipient.initialize()

    this._isInitialized = true
  }

  public async shutdown() {
    const stop$ = this.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    // All observables use takeUntil with the stop$ observable
    // this means all observables will stop running if a value is emitted on this observable
    stop$.next(true)

    // Stop transports
    const allTransports = [...this.inboundTransports, ...this.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)

    if (this.wallet.isInitialized) {
      await this.wallet.close()
    }

    this._isInitialized = false
  }

  protected registerDependencies(dependencyManager: DependencyManager) {
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
    dependencyManager.registerInstance(InjectionSymbols.AgentDependencies, this.agentConfig.agentDependencies)
    dependencyManager.registerInstance(InjectionSymbols.Stop$, new Subject<boolean>())
    dependencyManager.registerInstance(InjectionSymbols.FileSystem, new this.agentConfig.agentDependencies.FileSystem())

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
      new ConnectionsModule({
        autoAcceptConnections: this.agentConfig.autoAcceptConnections,
      }),
      new CredentialsModule({
        autoAcceptCredentials: this.agentConfig.autoAcceptCredentials,
      }),
      new ProofsModule({
        autoAcceptProofs: this.agentConfig.autoAcceptProofs,
      }),
      new MediatorModule({
        autoAcceptMediationRequests: this.agentConfig.autoAcceptMediationRequests,
      }),
      new RecipientModule({
        maximumMessagePickup: this.agentConfig.maximumMessagePickup,
        mediatorInvitationUrl: this.agentConfig.mediatorConnectionsInvite,
        mediatorPickupStrategy: this.agentConfig.mediatorPickupStrategy,
        mediatorPollingInterval: this.agentConfig.mediatorPollingInterval,
      }),
      new BasicMessagesModule(),
      new QuestionAnswerModule(),
      new GenericRecordsModule(),
      new LedgerModule({
        connectToLedgersOnStartup: this.agentConfig.connectToLedgersOnStartup,
        indyLedgers: this.agentConfig.indyLedgers,
      }),
      new DiscoverFeaturesModule(),
      new DidsModule(),
      new WalletModule(),
      new OutOfBandModule(),
      new IndyModule(),
      new W3cVcModule()
    )

    // TODO: contextCorrelationId for base wallet
    // Bind the default agent context to the container for use in modules etc.
    dependencyManager.registerInstance(
      AgentContext,
      new AgentContext({
        dependencyManager,
        contextCorrelationId: 'default',
      })
    )

    // If no agent context provider has been registered we use the default agent context provider.
    if (!this.dependencyManager.isRegistered(InjectionSymbols.AgentContextProvider)) {
      this.dependencyManager.registerSingleton(InjectionSymbols.AgentContextProvider, DefaultAgentContextProvider)
    }
  }

  protected async getMediationConnection(mediatorInvitationUrl: string) {
    const outOfBandInvitation = this.oob.parseInvitation(mediatorInvitationUrl)
    const outOfBandRecord = await this.oob.findByInvitationId(outOfBandInvitation.id)
    const [connection] = outOfBandRecord ? await this.connections.findAllByOutOfBandId(outOfBandRecord.id) : []

    if (!connection) {
      this.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await this.mediationRecipient.getRouting({ useDefaultMediator: false })

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
}
