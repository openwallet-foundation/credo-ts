import { InjectionSymbols } from '../../constants'
import type { DependencyManager, InjectionToken } from '../../plugins'
import { AgentConfig } from '../AgentConfig'
import type { AgentContextProvider } from './AgentContextProvider'

export class AgentContext {
  /**
   * Dependency manager holds all dependencies for the current context. Possibly a child of a parent dependency manager,
   * in which case all singleton dependencies from the parent context are also available to this context.
   */
  public readonly dependencyManager: DependencyManager

  /**
   * An identifier that allows to correlate this context across sessions. This identifier is created by the `AgentContextProvider`
   * and should only be meaningful to the `AgentContextProvider`. The `contextCorrelationId` MUST uniquely identity the context and
   * should be enough to start a new session.
   *
   * An example of the `contextCorrelationId` is for example the id of the `TenantRecord` that is associated with this context when using the tenant module.
   * The `TenantAgentContextProvider` will set the `contextCorrelationId` to the `TenantRecord` id when creating the context, and will be able to create a context
   * for a specific tenant using the `contextCorrelationId`.
   */
  public readonly contextCorrelationId: string

  public readonly isRootAgentContext: boolean

  public constructor({
    dependencyManager,
    contextCorrelationId,
    isRootAgentContext = false,
  }: {
    dependencyManager: DependencyManager
    contextCorrelationId: string
    isRootAgentContext?: boolean
  }) {
    this.dependencyManager = dependencyManager
    this.contextCorrelationId = contextCorrelationId
    this.isRootAgentContext = isRootAgentContext
  }

  /**
   * Convenience method to access the agent config for the current context.
   */
  public get config() {
    return this.dependencyManager.resolve(AgentConfig)
  }

  /**
   * End session the current agent context
   */
  public async endSession() {
    // TODO: we need to create a custom agent context per sesion
    // and then track if it has already been ended, because it's quite
    // easy to mess up the session count at the moment
    const agentContextProvider = this.dependencyManager.resolve<AgentContextProvider>(
      InjectionSymbols.AgentContextProvider
    )

    await agentContextProvider.endSessionForAgentContext(this)
  }

  public toJSON() {
    return {
      contextCorrelationId: this.contextCorrelationId,
    }
  }

  /**
   * Resolve a dependency
   */
  public resolve<T>(token: InjectionToken<T>): T {
    return this.dependencyManager.resolve(token)
  }
}
