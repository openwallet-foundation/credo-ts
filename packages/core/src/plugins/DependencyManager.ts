import type { AgentContext } from '../agent'
import type { ModulesMap } from '../agent/AgentModules'
import type { MessageHandler } from '../agent/MessageHandler'
import type { MessageHandlerMiddleware } from '../agent/MessageHandlerMiddleware'
import type { Constructor } from '../utils/mixins'
import type { DependencyContainer } from 'tsyringe'

import { container as rootContainer, InjectionToken, Lifecycle } from 'tsyringe'

import { FeatureRegistry } from '../agent/FeatureRegistry'
import { MessageHandlerRegistry } from '../agent/MessageHandlerRegistry'
import { CredoError } from '../error'

export { InjectionToken }

export class DependencyManager {
  public readonly container: DependencyContainer
  public readonly registeredModules: ModulesMap

  public constructor(
    container: DependencyContainer = rootContainer.createChildContainer(),
    registeredModules: ModulesMap = {}
  ) {
    this.container = container
    this.registeredModules = registeredModules
  }

  public registerModules(modules: ModulesMap) {
    const featureRegistry = this.resolve(FeatureRegistry)

    for (const [moduleKey, module] of Object.entries(modules)) {
      if (this.registeredModules[moduleKey]) {
        throw new CredoError(
          `Module with key ${moduleKey} has already been registered. Only a single module can be registered with the same key.`
        )
      }

      this.registeredModules[moduleKey] = module
      if (module.api) {
        this.registerContextScoped(module.api)
      }
      module.register(this, featureRegistry)
    }
  }

  public async initializeModules(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'initializeModule' called on DependencyManager different from the agent context for which 'initializeModule' is called. Make sure to call 'initializeModule' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.initialize?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'initialize' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  public async shutdownModules(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'shutdownModules' called on DependencyManager different from the agent context for which 'shutdownModules' is called. Make sure to call 'shutdownModules' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.shutdown?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'shutdown' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  public async initializeAgentContext(
    agentContext: AgentContext,
    moduleMetadata?: { [moduleName: string]: Record<string, unknown> | undefined }
  ) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'initializeAgentContext' called on DependencyManager different from the agent context for which 'initializeAgentContext' is called. Make sure to call 'initializeAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.onInitializeContext?.(agentContext, moduleMetadata?.[moduleName] ?? null)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onInitializeContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  public async deleteAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'deleteAgentContext' called on DependencyManager different from the agent context for which 'deleteAgentContext' is called. Make sure to call 'deleteAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.onDeleteContext?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onDeleteContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  public async provisionAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'provisionAgentContext' called on DependencyManager different from the agent context for which 'provisionAgentContext' is called. Make sure to call 'provisionAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    const moduleMetadata: Record<string, Record<string, unknown> | undefined> = {}

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        const metadata = await module.onProvisionContext?.(agentContext)
        if (metadata) moduleMetadata[moduleName] = metadata
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onProvisionContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }

    return agentContext
  }

  public async closeAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'closeAgentContext' called on DependencyManager different from the agent context for which 'closeAgentContext' is called. Make sure to call 'closeAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    await this.container.dispose()
    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.onCloseContext?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onCloseContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  public registerMessageHandlers(messageHandlers: MessageHandler[]) {
    const messageHandlerRegistry = this.resolve(MessageHandlerRegistry)

    for (const messageHandler of messageHandlers) {
      messageHandlerRegistry.registerMessageHandler(messageHandler)
    }
  }

  public registerMessageHandlerMiddleware(messageHandlerMiddleware: MessageHandlerMiddleware) {
    const messageHandlerRegistry = this.resolve(MessageHandlerRegistry)

    messageHandlerRegistry.registerMessageHandlerMiddleware(messageHandlerMiddleware)
  }

  public get fallbackMessageHandler() {
    const messageHandlerRegistry = this.resolve(MessageHandlerRegistry)

    return messageHandlerRegistry.fallbackMessageHandler
  }

  public get messageHandlerMiddlewares() {
    const messageHandlerRegistry = this.resolve(MessageHandlerRegistry)

    return messageHandlerRegistry.messageHandlerMiddlewares
  }

  /**
   * Sets the fallback message handler, the message handler that will be called if no handler
   * is registered for an incoming message type.
   */
  public setFallbackMessageHandler(fallbackMessageHandler: MessageHandler['handle']) {
    const messageHandlerRegistry = this.resolve(MessageHandlerRegistry)

    messageHandlerRegistry.setFallbackMessageHandler(fallbackMessageHandler)
  }

  public registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): void
  public registerSingleton<T>(token: Constructor<T>): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerSingleton<T = any>(fromOrToken: InjectionToken<T> | Constructor<T>, to?: any) {
    this.container.registerSingleton(fromOrToken, to)
  }

  public resolve<T>(token: InjectionToken<T>): T {
    return this.container.resolve(token)
  }

  public registerInstance<T>(token: InjectionToken<T>, instance: T) {
    this.container.registerInstance(token, instance)
  }

  public isRegistered<T>(token: InjectionToken<T>, recursive = false): boolean {
    return this.container.isRegistered(token, recursive)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerContextScoped<T = any>(token: Constructor<T>): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerContextScoped<T = any>(token: InjectionToken<T>, provider: Constructor<T>): void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerContextScoped(token: any, provider?: any) {
    if (provider) this.container.register(token, provider, { lifecycle: Lifecycle.ContainerScoped })
    else this.container.register(token, token, { lifecycle: Lifecycle.ContainerScoped })
  }

  public createChild() {
    return new DependencyManager(this.container.createChildContainer(), this.registeredModules)
  }
}
