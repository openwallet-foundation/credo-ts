import type { DependencyManager } from './DependencyManager'
import type { AgentContext } from '../agent'
import type { Update } from '../storage/migration/updates'
import type { Constructor } from '../utils/mixins'

export interface Module {
  api?: Constructor<unknown>
  register(dependencyManager: DependencyManager): void

  /**
   * Method that will be called to initialize a module. This method is only called once on startup
   * with the root agent context. It is meant to initialize services and requirements that are used
   * globally within the agent, such as a connection to an external ledger.
   *
   * For context specific dependencies it is recommened to use `onInitializeContext`, which will be
   * called for every context that is initialized.
   */
  initialize?(agentContext: AgentContext): Promise<void>

  /**
   * Method that will be called to shutdown a module. This method is only called once on shutdown
   * with the root agent context. It is meant to shutdown services and requirements that are used
   * globally within the agent, such as a connection to an external ledger.
   *
   * For context specific dependencies it is recommened to use `onCloseContext`, which will be
   * called for every context that is closed.
   */
  shutdown?(agentContext: AgentContext): Promise<void>

  /**
   * Method that will be called when an agent context is deleted, and will allow for cleanup of
   * data related to this agent context.
   */
  onDeleteContext?(agentContext: AgentContext): Promise<void>

  /**
   * Method that will be called when an agent context is provisioned/created, and will allow for setting
   * up of required services, data or other dependencies for an agent context.
   *
   * Optionally a metadata object can be returned which will be stored in storage of
   * the root agent context. Depending on the storage implementation used this may
   * be stored encrypted or in plaintext.
   */
  onProvisionContext?(agentContext: AgentContext): Promise<Record<string, unknown> | null>

  /**
   * Method that will be called when an agent context is initialized, and will allow for
   * setting up of required services, data or other dependencies for an agent context.
   *
   * Optionally a metdata object will be passed as second argument which will contain the
   * metadata associated with this module for this agent context.
   */
  onInitializeContext?(agentContext: AgentContext, metadata: Record<string, unknown> | null): Promise<void>

  /**
   * Method that will be called when an agent context is closed, and will allow for
   * closing of e.g. database sessions.
   */
  onCloseContext?(agentContext: AgentContext): Promise<void>

  /**
   * List of updates that should be executed when the framework version is updated.
   */
  updates?: Update[]
}

export interface ApiModule extends Module {
  api: Constructor<unknown>
}
