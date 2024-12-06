import type { AgentDependencies } from './AgentDependencies'
import type { AgentModulesInput } from './AgentModules'
import type { AgentMessageReceivedEvent } from './Events'
import type { InboundTransport } from '../transport/InboundTransport'
import type { OutboundTransport } from '../transport/OutboundTransport'
import type { InitConfig } from '../types'
import type { Subscription } from 'rxjs'

import { Subject } from 'rxjs'
import { mergeMap, takeUntil } from 'rxjs/operators'

import { InjectionSymbols } from '../constants'
import { SigningProviderToken } from '../crypto'
import { JwsService } from '../crypto/JwsService'
import { CredoError } from '../error'
import { DependencyManager } from '../plugins'
import { DidCommMessageRepository, StorageUpdateService, StorageVersionRepository } from '../storage'

import { AgentConfig } from './AgentConfig'
import { extendModulesWithDefaultModules } from './AgentModules'
import { BaseAgent } from './BaseAgent'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContext, DefaultAgentContextProvider } from './context'

interface AgentOptions<AgentModules extends AgentModulesInput> {
  config: InitConfig
  modules?: AgentModules
  dependencies: AgentDependencies
}

// Any makes sure you can use Agent as a type without always needing to specify the exact generics for the agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Agent<AgentModules extends AgentModulesInput = any> extends BaseAgent<AgentModules> {
  private messageSubscription?: Subscription

  public constructor(options: AgentOptions<AgentModules>, dependencyManager = new DependencyManager()) {
    const agentConfig = new AgentConfig(options.config, options.dependencies)
    const modulesWithDefaultModules = extendModulesWithDefaultModules(options.modules)

    // Register internal dependencies
    dependencyManager.registerSingleton(MessageHandlerRegistry)
    dependencyManager.registerSingleton(EventEmitter)
    dependencyManager.registerSingleton(MessageSender)
    dependencyManager.registerSingleton(MessageReceiver)
    dependencyManager.registerSingleton(TransportService)
    dependencyManager.registerSingleton(Dispatcher)
    dependencyManager.registerSingleton(EnvelopeService)
    dependencyManager.registerSingleton(FeatureRegistry)
    dependencyManager.registerSingleton(JwsService)
    dependencyManager.registerSingleton(DidCommMessageRepository)
    dependencyManager.registerSingleton(StorageVersionRepository)
    dependencyManager.registerSingleton(StorageUpdateService)

    // This is a really ugly hack to make tsyringe work without any SigningProviders registered
    // It is currently impossible to use @injectAll if there are no instances registered for the
    // token. We register a value of `default` by default and will filter that out in the registry.
    // Once we have a signing provider that should always be registered we can remove this. We can make an ed25519
    // signer using the @stablelib/ed25519 library.
    dependencyManager.registerInstance(SigningProviderToken, 'default')

    dependencyManager.registerInstance(AgentConfig, agentConfig)
    dependencyManager.registerInstance(InjectionSymbols.AgentDependencies, agentConfig.agentDependencies)
    dependencyManager.registerInstance(InjectionSymbols.Stop$, new Subject<boolean>())
    dependencyManager.registerInstance(InjectionSymbols.FileSystem, new agentConfig.agentDependencies.FileSystem())

    // Register all modules. This will also include the default modules
    dependencyManager.registerModules(modulesWithDefaultModules)

    // Register possibly already defined services
    if (!dependencyManager.isRegistered(InjectionSymbols.Wallet)) {
      throw new CredoError(
        "Missing required dependency: 'Wallet'. You can register it using the AskarModule, or implement your own."
      )
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.Logger)) {
      dependencyManager.registerInstance(InjectionSymbols.Logger, agentConfig.logger)
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError(
        "Missing required dependency: 'StorageService'. You can register it using the AskarModule, or implement your own."
      )
    }

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
    if (!dependencyManager.isRegistered(InjectionSymbols.AgentContextProvider)) {
      dependencyManager.registerSingleton(InjectionSymbols.AgentContextProvider, DefaultAgentContextProvider)
    }

    super(agentConfig, dependencyManager)
  }

  public registerInboundTransport(inboundTransport: InboundTransport) {
    this.messageReceiver.registerInboundTransport(inboundTransport)
  }

  public async unregisterInboundTransport(inboundTransport: InboundTransport) {
    await this.messageReceiver.unregisterInboundTransport(inboundTransport)
  }

  public get inboundTransports() {
    return this.messageReceiver.inboundTransports
  }

  public registerOutboundTransport(outboundTransport: OutboundTransport) {
    this.messageSender.registerOutboundTransport(outboundTransport)
  }

  public async unregisterOutboundTransport(outboundTransport: OutboundTransport) {
    await this.messageSender.unregisterOutboundTransport(outboundTransport)
  }

  public get outboundTransports() {
    return this.messageSender.outboundTransports
  }

  public get events() {
    return this.eventEmitter
  }

  /**
   * Agent's feature registry
   */
  public get features() {
    return this.featureRegistry
  }

  public async initialize() {
    const stop$ = this.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)

    // TODO: move to DIDComm module (along with transports)
    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    // We create this before doing any other initialization, so the initialization could already receive messages
    this.messageSubscription = this.eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(stop$),
        mergeMap(
          (e) =>
            this.messageReceiver
              .receiveMessage(e.payload.message, {
                connection: e.payload.connection,
                contextCorrelationId: e.payload.contextCorrelationId,
                session: e.payload.session,
              })
              .catch((error) => {
                this.logger.error('Failed to process message', { error })
              }),
          this.agentConfig.processDidCommMessagesConcurrently ? undefined : 1
        )
      )
      .subscribe()

    await this.dependencyManager.initializeModules(this.agentContext)
    await super.initialize()

    for (const transport of this.inboundTransports) {
      await transport.start(this)
    }

    for (const transport of this.outboundTransports) {
      await transport.start(this)
    }

    this._isInitialized = true
  }

  public async shutdown() {
    // TODO: relace stop$, should be replaced by module specific lifecycle methods
    const stop$ = this.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    // All observables use takeUntil with the stop$ observable
    // this means all observables will stop running if a value is emitted on this observable
    stop$.next(true)

    // TODO: move to DIDComm module
    // Stop transports
    const allTransports = [...this.inboundTransports, ...this.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)

    await this.dependencyManager.closeAgentContext(this.agentContext)
    await this.dependencyManager.shutdownModules(this.agentContext)

    this._isInitialized = false
  }
}
