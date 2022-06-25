import type { DependencyManager } from '../../plugins'
import type { Wallet } from '../../wallet'

import { InjectionSymbols } from '../../constants'
import { AgentConfig } from '../AgentConfig'

export class AgentContext {
  /**
   * Dependency manager holds all dependencies for the current context. Possibly a child of a parent dependency manager,
   * in which case all singleton dependencies from the parent context are also available to this context.
   */
  public readonly dependencyManager: DependencyManager

  /**
   * An identifier that allows to correlate this context across usages. An example of the contextCorrelationId could be
   * the id of the `TenantRecord` that is associated with this context. The AgentContextProvider can use this identifier to
   * correlate an inbound message to a specific context (if the message is not encrypted, it's impossible to correlate it to a tenant)
   */
  public readonly contextCorrelationId: string

  public constructor({
    dependencyManager,
    contextCorrelationId,
  }: {
    dependencyManager: DependencyManager
    contextCorrelationId: string
  }) {
    this.dependencyManager = dependencyManager
    this.contextCorrelationId = contextCorrelationId
  }

  /**
   * Convenience method to access the agent config for the current context.
   */
  public get config() {
    return this.dependencyManager.resolve(AgentConfig)
  }

  /**
   * Convenience method to access the wallet for the current context.
   */
  public get wallet() {
    return this.dependencyManager.resolve<Wallet>(InjectionSymbols.Wallet)
  }
}
