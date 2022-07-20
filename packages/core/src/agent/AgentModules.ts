import type { Module, DependencyManager } from '../plugins'
import type { Constructor } from '../utils/mixins'
import type { AgentConfig } from './AgentConfig'

import { BasicMessagesModule } from '../modules/basic-messages'
import { ConnectionsModule } from '../modules/connections'
import { CredentialsModule } from '../modules/credentials'
import { DidsModule } from '../modules/dids'
import { DiscoverFeaturesModule } from '../modules/discover-features'
import { GenericRecordsModule } from '../modules/generic-records'
import { IndyModule } from '../modules/indy'
import { LedgerModule } from '../modules/ledger'
import { OutOfBandModule } from '../modules/oob'
import { ProofsModule } from '../modules/proofs'
import { QuestionAnswerModule } from '../modules/question-answer'
import { MediatorModule, RecipientModule } from '../modules/routing'
import { W3cVcModule } from '../modules/vc'
import { WalletModule } from '../wallet'

/**
 * Simple utility type that represent a map of modules. This is used to map from moduleKey (api key) to the api in the framework.
 */
export type ModulesMap = { [key: string]: Module }

/**
 * Default modules can be optionally defined to provide custom configuration. This type makes it so that it is not
 * possible to use a different key for the default modules
 */
export type AgentModulesInput = Partial<DefaultAgentModules> & ModulesMap

/**
 * Type that represents the default agent modules. This is the {@link ModulesMap} variant for the default modules in the framework.
 * It uses the return type of the {@link getDefaultAgentModules} method to automatically infer which modules are always available on
 * the agent and in the agent. namespace.
 */
export type DefaultAgentModules = {
  [moduleKey in keyof ReturnType<typeof getDefaultAgentModules>]: ReturnType<
    ReturnType<typeof getDefaultAgentModules>[moduleKey]
  >
}

/**
 * Type that represents the api object of the agent (`agent.xxx`). It will extract all keys of the modules and map this to the
 * registered {@link Module.api} class instance. If the module does not have an api class registered, the property will be removed
 * and won't be available on the api object.
 *
 * @example
 * If the following AgentModules type was passed:
 * ```ts
 * {
 *   connections: ConnectionsModule
 *   indy: IndyModule
 * }
 * ```
 *
 * And we use the `AgentApi` type like this:
 * ```ts
 * type MyAgentApi = AgentApi<{
 *   connections: ConnectionsModule
 *   indy: IndyModule
 * }>
 * ```
 *
 * the resulting agent api will look like:
 *
 * ```ts
 * {
 *   connections: ConnectionsApi
 * }
 * ```
 *
 * The `indy` module has been ignored because it doesn't define an api class.
 */
export type AgentApi<Modules extends ModulesMap> = {
  [moduleKey in keyof Modules as Modules[moduleKey]['api'] extends Constructor<unknown>
    ? moduleKey
    : never]: Modules[moduleKey]['api'] extends Constructor<unknown> ? InstanceType<Modules[moduleKey]['api']> : never
}

/**
 * Agent api for the default agent modules.
 */
export type DefaultAgentApi = AgentApi<DefaultAgentModules>

/**
 * Method to get the default agent modules to be registered on any agent instance.
 *
 * @note This implementation is quite ugly and is meant to be temporary. It extracts the module specific config from the agent config
 * and will only construct the module if the method is called. This prevents the modules from being initialized if they are already configured by the end
 * user using the `module` property in the agent constructor.
 */
function getDefaultAgentModules(agentConfig: AgentConfig) {
  return {
    connections: () =>
      new ConnectionsModule({
        autoAcceptConnections: agentConfig.autoAcceptConnections,
      }),
    credentials: () =>
      new CredentialsModule({
        autoAcceptCredentials: agentConfig.autoAcceptCredentials,
      }),
    proofs: () =>
      new ProofsModule({
        autoAcceptProofs: agentConfig.autoAcceptProofs,
      }),
    mediator: () =>
      new MediatorModule({
        autoAcceptMediationRequests: agentConfig.autoAcceptMediationRequests,
      }),
    mediationRecipient: () =>
      new RecipientModule({
        maximumMessagePickup: agentConfig.maximumMessagePickup,
        mediatorInvitationUrl: agentConfig.mediatorConnectionsInvite,
        mediatorPickupStrategy: agentConfig.mediatorPickupStrategy,
        mediatorPollingInterval: agentConfig.mediatorPollingInterval,
      }),
    basicMessages: () => new BasicMessagesModule(),
    questionAnswer: () => new QuestionAnswerModule(),
    genericRecords: () => new GenericRecordsModule(),
    ledger: () =>
      new LedgerModule({
        connectToIndyLedgersOnStartup: agentConfig.connectToIndyLedgersOnStartup,
        indyLedgers: agentConfig.indyLedgers,
      }),
    discovery: () => new DiscoverFeaturesModule(),
    dids: () => new DidsModule(),
    wallet: () => new WalletModule(),
    oob: () => new OutOfBandModule(),
    indy: () => new IndyModule(),
    w3cVc: () => new W3cVcModule(),
  } as const
}

/**
 * Extend the provided modules object with the default agent modules. If the modules property already contains a module with the same
 * name as a default module, the module won't be added to the extended module object. This allows users of the framework to override
 * the modules with custom configuration. The agent constructor type ensures you can't provide a different module for a key that registered
 * on the default agent.
 */
export function extendModulesWithDefaultModules<AgentModules extends AgentModulesInput>(
  agentConfig: AgentConfig,
  modules?: AgentModules
): AgentModules & DefaultAgentModules {
  const extendedModules: Record<string, Module> = { ...modules }
  const defaultAgentModules = getDefaultAgentModules(agentConfig)

  // Register all default modules, if not registered yet
  for (const [moduleKey, getConfiguredModule] of Object.entries(defaultAgentModules)) {
    // Do not register if the module is already registered.
    if (modules && modules[moduleKey]) continue

    extendedModules[moduleKey] = getConfiguredModule()
  }

  return extendedModules as AgentModules & DefaultAgentModules
}

/**
 * Get the agent api object based on the modules registered in the dependency manager. For each registered module on the
 * dependency manager, the method will extract the api class from the module, resolve it and assign it to the module key
 * as provided in the agent constructor (or the {@link getDefaultAgentModules} method).
 *
 * Modules that don't have an api class defined ({@link Module.api} is undefined) will be ignored and won't be added to the
 * api object.
 *
 * @example
 * If the dependency manager has the following modules configured:
 * ```ts
 * {
 *   connections: ConnectionsModule
 *   indy: IndyModule
 * }
 * ```
 *
 * And we call the `getAgentApi` method like this:
 * ```ts
 * const api = getAgentApi(dependencyManager)
 * ```
 *
 * the resulting agent api will look like:
 *
 * ```ts
 * {
 *   connections: ConnectionsApi
 * }
 * ```
 *
 * The `indy` module has been ignored because it doesn't define an api class.
 */
export function getAgentApi<AgentModules extends ModulesMap>(
  dependencyManager: DependencyManager
): AgentApi<AgentModules> {
  // Create the api object based on the `api` properties on the modules. If no `api` exists
  // on the module it will be ignored.
  const api = Object.entries(dependencyManager.registeredModules).reduce((api, [moduleKey, module]) => {
    if (!module.api) return api
    return { ...api, [moduleKey]: dependencyManager.resolve(module.api) }
  }, {}) as AgentApi<AgentModules>

  return api
}
