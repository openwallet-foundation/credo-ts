import type { DependencyManager } from '../plugins'
import type { Wallet } from '../wallet'

import { InjectionSymbols } from '../constants'

import { AgentConfig } from './AgentConfig'

export class AgentContext {
  /**
   * Dependency manager holds all dependencies for the current context. Possibly a child of a parent dependency manager,
   * in which case all singleton dependencies from the parent context are also available to this context.
   */
  public readonly dependencyManager: DependencyManager

  public constructor({ dependencyManager }: { dependencyManager: DependencyManager }) {
    this.dependencyManager = dependencyManager
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
