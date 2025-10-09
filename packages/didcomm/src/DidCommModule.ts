import type { AgentContext, DependencyManager, Module, Update } from '@credo-ts/core'
import type { Subject } from 'rxjs'
import type { DidCommMessageReceivedEvent } from './DidCommEvents'
import type { DidCommModuleConfigOptions } from './DidCommModuleConfig'

import { EventEmitter, InjectionSymbols } from '@credo-ts/core'
import { mergeMap, takeUntil } from 'rxjs'

import { DidCommApi } from './DidCommApi'
import { DidCommDispatcher } from './DidCommDispatcher'
import { DidCommEnvelopeService } from './DidCommEnvelopeService'
import { DidCommEventTypes } from './DidCommEvents'
import { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'
import { DidCommMessageReceiver } from './DidCommMessageReceiver'
import { DidCommMessageSender } from './DidCommMessageSender'
import { DidCommModuleConfig } from './DidCommModuleConfig'
import { DidCommTransportService } from './DidCommTransportService'
import { DidCommMessageRepository } from './repository'
import { updateV0_1ToV0_2 } from './updates/0.1-0.2'
import { updateV0_2ToV0_3 } from './updates/0.2-0.3'
import { updateV0_4ToV0_5 } from './updates/0.4-0.5'
import { updateV0_5ToV0_6 } from './updates/0.5-0.6'

export class DidCommModule implements Module {
  public readonly config: DidCommModuleConfig
  public readonly api = DidCommApi

  public constructor(config?: DidCommModuleConfigOptions) {
    this.config = new DidCommModuleConfig(config)
  }

  /**
   * Registers the dependencies on the dependency manager.
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

    // Features
    // TODO: Constraints?
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const stop$ = agentContext.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    const messageReceiver = agentContext.dependencyManager.resolve(DidCommMessageReceiver)
    const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)

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

    for (const transport of messageReceiver.inboundTransports) {
      await transport.start(agentContext)
    }

    for (const transport of messageSender.outboundTransports) {
      await transport.start(agentContext)
    }
  }

  public async shutdown(agentContext: AgentContext) {
    const messageReceiver = agentContext.dependencyManager.resolve(DidCommMessageReceiver)
    const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)

    // Stop transports
    const allTransports = [...messageReceiver.inboundTransports, ...messageSender.outboundTransports]
    const transportPromises = allTransports.map((transport) => transport.stop())
    await Promise.all(transportPromises)
  }

  public updates = [
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
    {
      fromVersion: '0.5',
      toVersion: '0.6',
      doUpdate: updateV0_5ToV0_6,
    },
  ] satisfies Update[]
}
