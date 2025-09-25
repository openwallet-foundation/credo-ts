import type { AgentContext, Constructor, DependencyManager, Module, Update } from '@credo-ts/core'
import type { Subject } from 'rxjs'
import type { DidCommModuleConfigOptions } from './DidCommModuleConfig'
import type { AgentMessageReceivedEvent } from './Events'

import { EventEmitter, InjectionSymbols } from '@credo-ts/core'
import { mergeMap, takeUntil } from 'rxjs'

import { DidCommApi } from './DidCommApi'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import { Dispatcher } from './Dispatcher'
import { EnvelopeService } from './EnvelopeService'
import { AgentEventTypes } from './Events'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageHandlerRegistry } from './MessageHandlerRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import {
  BasicMessagesModule,
  ConnectionsModule,
  CredentialProtocol,
  CredentialsModule,
  CredentialsModuleConfigOptions,
  DefaultCredentialProtocols,
  DefaultMessagePickupProtocols,
  DefaultProofProtocols,
  DiscoverFeaturesModule,
  MediationRecipientModule,
  MediatorModule,
  MessagePickupModule,
  MessagePickupModuleConfigOptions,
  MessagePickupProtocol,
  OutOfBandModule,
  ProofProtocol,
  ProofsModule,
  ProofsModuleConfigOptions,
} from './modules'
import { DidCommMessageRepository } from './repository'
import { DidCommDocumentService } from './services'
import { updateV0_1ToV0_2 } from './updates/0.1-0.2'
import { updateV0_2ToV0_3 } from './updates/0.2-0.3'
import { updateV0_4ToV0_5 } from './updates/0.4-0.5'

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type ModuleOrEmpty<Config, Module> = Config extends false ? {} : Module

type DidCommModules<Options extends DidCommModuleConfigOptions> = {
  connections: ConnectionsModule
  oob: OutOfBandModule
  discovery: DiscoverFeaturesModule
} & ModuleOrEmpty<
  Options['credentials'],
  {
    credentials: CredentialsModule<
      Options['credentials'] extends CredentialsModuleConfigOptions<CredentialProtocol[]>
        ? Options['credentials']['credentialProtocols']
        : DefaultCredentialProtocols
    >
  }
> &
  ModuleOrEmpty<
    Options['proofs'],
    {
      proofs: ProofsModule<
        Options['proofs'] extends ProofsModuleConfigOptions<ProofProtocol[]>
          ? Options['proofs']['proofProtocols']
          : DefaultProofProtocols
      >
    }
  > &
  ModuleOrEmpty<
    Options['messagePickup'],
    {
      messagePickup: MessagePickupModule<
        Options['messagePickup'] extends MessagePickupModuleConfigOptions<MessagePickupProtocol[]>
          ? Options['messagePickup']['protocols']
          : DefaultMessagePickupProtocols
      >
    }
  > &
  ModuleOrEmpty<Options['mediator'], { mediator: MediatorModule }> &
  ModuleOrEmpty<Options['mediationRecipient'], { mediationRecipient: MediationRecipientModule }> &
  ModuleOrEmpty<Options['basicMessages'], { basicMessages: BasicMessagesModule }>

function getDidcommModules<Options extends DidCommModuleConfigOptions>(options: Options): DidCommModules<Options> {
  return {
    connections: new ConnectionsModule(options.connections),
    oob: new OutOfBandModule(),
    discovery: new DiscoverFeaturesModule(options.discovery),

    credentials:
      options.credentials !== false
        ? new CredentialsModule(options.credentials === true ? {} : options.credentials)
        : undefined,

    proofs: options.proofs !== false ? new ProofsModule(options.proofs === true ? {} : options.proofs) : undefined,

    mediator:
      options.mediator !== false ? new MediatorModule(options.mediator === true ? {} : options.mediator) : undefined,

    mediationRecipient:
      options.mediationRecipient !== false
        ? new MediationRecipientModule(options.mediationRecipient === true ? {} : options.mediationRecipient)
        : undefined,

    messagePickup:
      options.messagePickup !== false
        ? new MessagePickupModule(options.messagePickup === true ? {} : options.messagePickup)
        : undefined,

    basicMessages: options.basicMessages !== false ? new BasicMessagesModule() : undefined,
  } as unknown as DidCommModules<Options>
}

export class DidCommModule<Options extends DidCommModuleConfigOptions> implements Module {
  public readonly config: DidCommModuleConfig<Options>
  public readonly api: typeof DidCommApi<Options> = DidCommApi

  public readonly modules: ReturnType<typeof getDidcommModules<Options>>

  public constructor(config?: Options) {
    this.config = new DidCommModuleConfig<Options>(config)
    this.modules = getDidcommModules(config ?? {})
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommModuleConfig, this.config)

    // Registries
    dependencyManager.registerSingleton(MessageHandlerRegistry)
    dependencyManager.registerSingleton(FeatureRegistry)

    // Services
    dependencyManager.registerSingleton(MessageSender)
    dependencyManager.registerSingleton(MessageReceiver)
    dependencyManager.registerSingleton(TransportService)
    dependencyManager.registerSingleton(Dispatcher)
    dependencyManager.registerSingleton(EnvelopeService)
    dependencyManager.registerSingleton(DidCommDocumentService)

    // Repositories
    dependencyManager.registerSingleton(DidCommMessageRepository)

    for (const [_moduleKey, module] of Object.entries(this.modules)) {
      module.register(dependencyManager)

      if (module.api) {
        dependencyManager.registerContextScoped(module.api as Constructor<unknown>)
      }
    }
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const stop$ = agentContext.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    const messageReceiver = agentContext.dependencyManager.resolve(MessageReceiver)
    const messageSender = agentContext.dependencyManager.resolve(MessageSender)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    // We create this before doing any other initialization, so the initialization could already receive messages
    eventEmitter
      .observable<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived)
      .pipe(
        takeUntil(stop$),
        mergeMap(
          (e) =>
            messageReceiver
              .receiveMessage(e.payload.message, {
                connection: e.payload.connection,
                contextCorrelationId: e.payload.contextCorrelationId,
                session: e.payload.session,
                receivedAt: e.payload.receivedAt,
              })
              .catch((error) => {
                agentContext.config.logger.error('Failed to process message', { error })
              }),
          this.config.processDidCommMessagesConcurrently ? undefined : 1
        )
      )
      .subscribe()

    for (const transport of messageReceiver.inboundTransports) {
      await transport.start(agentContext)
    }

    for (const transport of messageSender.outboundTransports) {
      await transport.start(agentContext)
    }

    for (const module of Object.values(this.modules)) {
      await module.initialize?.(agentContext)
    }
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    for (const module of Object.values(this.modules)) {
      const standardModule = module as Module
      await standardModule.onInitializeContext?.(agentContext)
    }
  }

  public async onCloseContext(agentContext: AgentContext): Promise<void> {
    for (const module of Object.values(this.modules)) {
      const standardModule = module as Module
      await standardModule.onCloseContext?.(agentContext)
    }
  }

  public async onDeleteContext(agentContext: AgentContext): Promise<void> {
    for (const module of Object.values(this.modules)) {
      const standardModule = module as Module
      await standardModule.onDeleteContext?.(agentContext)
    }
  }

  public async onProvisionContext(agentContext: AgentContext): Promise<void> {
    for (const module of Object.values(this.modules)) {
      const standardModule = module as Module
      await standardModule.onProvisionContext?.(agentContext)
    }
  }

  public async shutdown(agentContext: AgentContext) {
    const messageReceiver = agentContext.dependencyManager.resolve(MessageReceiver)
    const messageSender = agentContext.dependencyManager.resolve(MessageSender)

    // Stop transports
    const allTransports = [...messageReceiver.inboundTransports, ...messageSender.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)

    for (const module of Object.values(this.modules)) {
      const standardModule = module as Module
      await standardModule.shutdown?.(agentContext)
    }
  }

  public get updates() {
    return [
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: updateV0_1ToV0_2,
      },
      {
        fromVersion: '0.2',
        toVersion: '0.3',
        doUpdate: updateV0_2ToV0_3,
      },
      {
        fromVersion: '0.4',
        toVersion: '0.5',
        doUpdate: updateV0_4ToV0_5,
      },
    ] satisfies Update[]
  }
}
