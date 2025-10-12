import type { AgentContext, Constructor, DependencyManager, Module, Update } from '@credo-ts/core'
import { EventEmitter, InjectionSymbols } from '@credo-ts/core'
import type { Subject } from 'rxjs'
import { mergeMap, takeUntil } from 'rxjs'
import { DidCommApi } from './DidCommApi'
import { DidCommDispatcher } from './DidCommDispatcher'
import { DidCommEnvelopeService } from './DidCommEnvelopeService'
import type { DidCommMessageReceivedEvent } from './DidCommEvents'
import { DidCommEventTypes } from './DidCommEvents'
import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageReceiver } from './DidCommMessageReceiver'
import { DidCommMessageSender } from './DidCommMessageSender'
import type { DidCommModuleConfigOptions } from './DidCommModuleConfig'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import { DidCommTransportService } from './DidCommTransportService'
import {
  type DefaultDidCommMessagePickupProtocols,
  type DefaultDidCommProofProtocols,
  DidCommBasicMessagesModule,
  DidCommConnectionsModule,
  type DidCommCredentialProtocol,
  DidCommDiscoverFeaturesModule,
  DidCommMessagePickupModule,
  type DidCommMessagePickupModuleConfigOptions,
  type DidCommMessagePickupProtocol,
  DidCommOutOfBandModule,
  type DidCommProofProtocol,
  DidCommProofsModule,
  type DidCommProofsModuleConfigOptions,
} from './modules'
import {
  type DefaultDidCommCredentialProtocols,
  DidCommCredentialsModule,
} from './modules/credentials/DidCommCredentialsModule'
import type { DidCommCredentialsModuleConfigOptions } from './modules/credentials/DidCommCredentialsModuleConfig'
import { DidCommMediationRecipientModule } from './modules/routing/DidCommMediationRecipientModule'
import { DidCommMediatorModule } from './modules/routing/DidCommMediatorModule'
import { DidCommMessageRepository } from './repository'
import { updateV0_1ToV0_2 } from './updates/0.1-0.2'
import { updateV0_2ToV0_3 } from './updates/0.2-0.3'
import { updateV0_4ToV0_5 } from './updates/0.4-0.5'

// biome-ignore lint/complexity/noBannedTypes: no explanation
type ModuleOrEmpty<Config, Module> = Config extends false ? {} : Module

type DidCommModules<Options extends DidCommModuleConfigOptions> = {
  connections: DidCommConnectionsModule
  oob: DidCommOutOfBandModule
  discovery: DidCommDiscoverFeaturesModule
} & ModuleOrEmpty<
  Options['credentials'],
  {
    credentials: DidCommCredentialsModule<
      Options['credentials'] extends DidCommCredentialsModuleConfigOptions<DidCommCredentialProtocol[]>
        ? Options['credentials']['credentialProtocols']
        : DefaultDidCommCredentialProtocols
    >
  }
> &
  ModuleOrEmpty<
    Options['proofs'],
    {
      proofs: DidCommProofsModule<
        Options['proofs'] extends DidCommProofsModuleConfigOptions<DidCommProofProtocol[]>
          ? Options['proofs']['proofProtocols']
          : DefaultDidCommProofProtocols
      >
    }
  > &
  ModuleOrEmpty<
    Options['messagePickup'],
    {
      messagePickup: DidCommMessagePickupModule<
        Options['messagePickup'] extends DidCommMessagePickupModuleConfigOptions<DidCommMessagePickupProtocol[]>
          ? Options['messagePickup']['protocols']
          : DefaultDidCommMessagePickupProtocols
      >
    }
  > &
  ModuleOrEmpty<Options['mediator'], { mediator: DidCommMediatorModule }> &
  ModuleOrEmpty<Options['mediationRecipient'], { mediationRecipient: DidCommMediationRecipientModule }> &
  ModuleOrEmpty<Options['basicMessages'], { basicMessages: DidCommBasicMessagesModule }>

function getDidcommModules<Options extends DidCommModuleConfigOptions>(options: Options): DidCommModules<Options> {
  return {
    connections: new DidCommConnectionsModule(options.connections),
    oob: new DidCommOutOfBandModule(),
    discovery: new DidCommDiscoverFeaturesModule(options.discovery),

    credentials:
      options.credentials !== false
        ? new DidCommCredentialsModule(options.credentials === true ? {} : options.credentials)
        : undefined,

    proofs:
      options.proofs !== false ? new DidCommProofsModule(options.proofs === true ? {} : options.proofs) : undefined,

    mediator:
      options.mediator !== false
        ? new DidCommMediatorModule(options.mediator === true ? {} : options.mediator)
        : undefined,

    mediationRecipient:
      options.mediationRecipient !== false
        ? new DidCommMediationRecipientModule(options.mediationRecipient === true ? {} : options.mediationRecipient)
        : undefined,

    messagePickup:
      options.messagePickup !== false
        ? new DidCommMessagePickupModule(options.messagePickup === true ? {} : options.messagePickup)
        : undefined,

    basicMessages: options.basicMessages !== false ? new DidCommBasicMessagesModule() : undefined,
  } as unknown as DidCommModules<Options>
}

export class DidCommModule<Options extends DidCommModuleConfigOptions = DidCommModuleConfigOptions> implements Module {
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
    dependencyManager.registerSingleton(DidCommMessageHandlerRegistry)
    dependencyManager.registerSingleton(DidCommFeatureRegistry)

    // Services
    dependencyManager.registerSingleton(DidCommMessageSender)
    dependencyManager.registerSingleton(DidCommMessageReceiver)
    dependencyManager.registerSingleton(DidCommTransportService)
    dependencyManager.registerSingleton(DidCommDispatcher)
    dependencyManager.registerSingleton(DidCommEnvelopeService)

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
    const messageReceiver = agentContext.dependencyManager.resolve(DidCommMessageReceiver)

    // Listen for new messages (either from transports or somewhere else in the framework / extensions)
    // We create this before doing any other initialization, so the initialization could already receive messages
    eventEmitter
      .observable<DidCommMessageReceivedEvent>(DidCommEventTypes.DidCommMessageReceived)
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

    for (const transport of this.config.inboundTransports) {
      await transport.start(agentContext)
    }

    for (const transport of this.config.outboundTransports) {
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
    // Stop transports
    const allTransports = [...this.config.inboundTransports, ...this.config.outboundTransports]
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
