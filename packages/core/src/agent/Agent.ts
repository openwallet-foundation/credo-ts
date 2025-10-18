import { Subject } from 'rxjs'
import { InjectionSymbols } from '../constants'
import { JwsService } from '../crypto/JwsService'
import { CredoError } from '../error'
import { DependencyManager } from '../plugins'
import { isStorageUpToDate, StorageUpdateService, StorageVersionRepository, UpdateAssistant } from '../storage'
import type { InitConfig } from '../types'
import { AgentConfig } from './AgentConfig'
import type { AgentDependencies } from './AgentDependencies'
import type { AgentModulesInput } from './AgentModules'
import { extendModulesWithDefaultModules } from './AgentModules'
import { BaseAgent } from './BaseAgent'
import { AgentContext, DefaultAgentContextProvider } from './context'
import { EventEmitter } from './EventEmitter'

interface AgentOptions<AgentModules extends AgentModulesInput> {
  config?: InitConfig
  modules?: AgentModules
  dependencies: AgentDependencies
}

// Any makes sure you can use Agent as a type without always needing to specify the exact generics for the agent
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export class Agent<AgentModules extends AgentModulesInput = any> extends BaseAgent<AgentModules> {
  public constructor(options: AgentOptions<AgentModules>, dependencyManager = new DependencyManager()) {
    const agentConfig = new AgentConfig(options.config ?? {}, options.dependencies)
    const modulesWithDefaultModules = extendModulesWithDefaultModules(options.modules)

    // Register internal dependencies
    dependencyManager.registerSingleton(EventEmitter)
    dependencyManager.registerSingleton(JwsService)
    dependencyManager.registerSingleton(StorageVersionRepository)
    dependencyManager.registerSingleton(StorageUpdateService)

    dependencyManager.registerInstance(AgentConfig, agentConfig)
    dependencyManager.registerInstance(InjectionSymbols.AgentDependencies, agentConfig.agentDependencies)
    dependencyManager.registerInstance(InjectionSymbols.Stop$, new Subject<boolean>())
    dependencyManager.registerInstance(InjectionSymbols.FileSystem, new agentConfig.agentDependencies.FileSystem())

    // Register all modules. This will also include the default modules
    dependencyManager.registerModules(modulesWithDefaultModules)

    if (!dependencyManager.isRegistered(InjectionSymbols.Logger)) {
      dependencyManager.registerInstance(InjectionSymbols.Logger, agentConfig.logger)
    }
    if (!dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError(
        "Missing required dependency: 'StorageService'. You can register it using the AskarModule, DrizzleStorageModule, or implement your own."
      )
    }

    // TODO: contextCorrelationId for base wallet
    // Bind the default agent context to the container for use in modules etc.
    dependencyManager.registerInstance(
      AgentContext,
      new AgentContext({
        dependencyManager,
        contextCorrelationId: 'default',
        isRootAgentContext: true,
      })
    )

    // If no agent context provider has been registered we use the default agent context provider.
    if (!dependencyManager.isRegistered(InjectionSymbols.AgentContextProvider)) {
      dependencyManager.registerSingleton(InjectionSymbols.AgentContextProvider, DefaultAgentContextProvider)
    }

    super(agentConfig, dependencyManager)
  }

  public get events() {
    return this.eventEmitter
  }

  public async initialize() {
    if (this._isInitialized) {
      throw new CredoError(
        'Agent already initialized. Currently it is not supported to re-initialize an already initialized agent.'
      )
    }

    // We first initialize all the modules
    await this.dependencyManager.initializeModules(this.agentContext)

    // Then we initialize the root agent context
    await this.dependencyManager.initializeAgentContext(this.agentContext)

    // Make sure the storage is up to date
    const storageUpdateService = this.dependencyManager.resolve(StorageUpdateService)
    const currentStorageVersion = await storageUpdateService.getCurrentStorageVersion(this.agentContext)
    const mustUpdate = !isStorageUpToDate(currentStorageVersion, StorageUpdateService.previousFrameworkStorageVersion)
    const canUpdate = !isStorageUpToDate(currentStorageVersion, StorageUpdateService.frameworkStorageVersion)
    if (canUpdate) {
      this.logger.info(
        `Agent storage is not up to date. Current storage version is ${currentStorageVersion}, latest storage version is ${StorageUpdateService.frameworkStorageVersion}`
      )
    } else {
      this.logger.info(`Agent storage is up to date. `)
    }

    if (canUpdate && this.agentConfig.autoUpdateStorageOnStartup) {
      const updateAssistant = new UpdateAssistant(this)

      await updateAssistant.initialize()
      await updateAssistant.update()
    } else if (mustUpdate) {
      // Close agent context to prevent un-initialized agent with initialized agent context
      await this.dependencyManager.closeAgentContext(this.agentContext)

      throw new CredoError(
        // TODO: add link to where documentation on how to update can be found.
        `Current agent storage is not up to date. To prevent the framework state from getting corrupted the agent initialization is aborted. Make sure to update the agent storage (currently at ${currentStorageVersion}) to the latest or previous version (${UpdateAssistant.frameworkStorageVersion} or ${UpdateAssistant.previousFrameworkStorageVersion}). You can also downgrade your version of Credo.`
      )
    }

    this._isInitialized = true
  }

  public async shutdown() {
    // TODO: replace stop$, should be replaced by module specific lifecycle methods
    const stop$ = this.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    // All observables use takeUntil with the stop$ observable
    // this means all observables will stop running if a value is emitted on this observable
    stop$.next(true)

    await this.dependencyManager.shutdownModules(this.agentContext)
    await this.dependencyManager.closeAgentContext(this.agentContext)

    this._isInitialized = false
  }
}
