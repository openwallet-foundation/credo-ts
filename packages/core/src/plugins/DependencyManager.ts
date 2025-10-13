import type { DependencyContainer } from 'tsyringe'
import { type InjectionToken, Lifecycle, container as rootContainer } from 'tsyringe'
import type { AgentContext } from '../agent'
import type { ModulesMap } from '../agent/AgentModules'
import { CredoError } from '../error'
import type { Constructor } from '../utils/mixins'

export type { InjectionToken }

export class DependencyManager {
  public readonly container: DependencyContainer
  public readonly registeredModules: ModulesMap

  /**
   * @internal
   */
  public constructor(
    container: DependencyContainer = rootContainer.createChildContainer(),
    registeredModules: ModulesMap = {}
  ) {
    this.container = container
    this.registeredModules = registeredModules
  }

  /**
   * @internal
   */
  public registerModules(modules: ModulesMap) {
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
      try {
        module.register(this)
      } catch (error) {
        throw new CredoError(`Cannot register ${moduleKey}: ${error}`)
      }
    }
  }

  /**
   * @internal
   */
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

  /**
   * @internal
   */
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

  /**
   * @internal
   */
  public async initializeAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'initializeAgentContext' called on DependencyManager different from the agent context for which 'initializeAgentContext' is called. Make sure to call 'initializeAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.onInitializeContext?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onInitializeContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }
  }

  /**
   * @internal
   */
  public async deleteAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'deleteAgentContext' called on DependencyManager different from the agent context for which 'deleteAgentContext' is called. Make sure to call 'deleteAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    try {
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
    } finally {
      await this.container.dispose()
    }
  }

  /**
   * @internal
   */
  public async provisionAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'provisionAgentContext' called on DependencyManager different from the agent context for which 'provisionAgentContext' is called. Make sure to call 'provisionAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    for (const [moduleName, module] of Object.entries(this.registeredModules)) {
      try {
        await module.onProvisionContext?.(agentContext)
      } catch (error) {
        throw new CredoError(
          `Error during call to 'onProvisionContext' method in module '${moduleName}' for agent context '${agentContext.contextCorrelationId}'.`,
          { cause: error }
        )
      }
    }

    return agentContext
  }

  /**
   * @internal
   */
  public async closeAgentContext(agentContext: AgentContext) {
    if (agentContext.dependencyManager.container !== this.container) {
      throw new CredoError(
        `Method 'closeAgentContext' called on DependencyManager different from the agent context for which 'closeAgentContext' is called. Make sure to call 'closeAgentContext' on the DependencyManager associated with the agent context.`
      )
    }

    try {
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
    } finally {
      // NOTE: we support reinitialization of the root agent so we can't dispose of the agent context
      if (!agentContext.isRootAgentContext) {
        await this.container.dispose()
      }
    }
  }

  public registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): void
  public registerSingleton<T>(token: Constructor<T>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
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

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public registerContextScoped<T = any>(token: Constructor<T>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public registerContextScoped<T = any>(token: InjectionToken<T>, provider: Constructor<T>): void

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public registerContextScoped(token: any, provider?: any) {
    if (provider) this.container.register(token, provider, { lifecycle: Lifecycle.ContainerScoped })
    else this.container.register(token, token, { lifecycle: Lifecycle.ContainerScoped })
  }

  /**
   * @internal
   */
  public createChild() {
    return new DependencyManager(this.container.createChildContainer(), this.registeredModules)
  }
}
