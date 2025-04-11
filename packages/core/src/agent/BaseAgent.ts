import type { Logger } from '../logger'
import type { DependencyManager } from '../plugins'
import type { AgentConfig } from './AgentConfig'
import type { AgentApi, EmptyModuleMap, ModulesMap, WithoutDefaultModules } from './AgentModules'

import { CredoError } from '../error'
import { DidsApi } from '../modules/dids'
import { GenericRecordsApi } from '../modules/generic-records'
import { KeyManagementApi } from '../modules/kms'
import { MdocApi } from '../modules/mdoc'
import { SdJwtVcApi } from '../modules/sd-jwt-vc'
import { W3cCredentialsApi } from '../modules/vc/W3cCredentialsApi'
import { X509Api } from '../modules/x509'
import { StorageUpdateService } from '../storage'
import { UpdateAssistant } from '../storage/migration/UpdateAssistant'

import { getAgentApi } from './AgentModules'
import { EventEmitter } from './EventEmitter'
import { AgentContext } from './context'

export abstract class BaseAgent<AgentModules extends ModulesMap = EmptyModuleMap> {
  protected logger: Logger
  protected eventEmitter: EventEmitter
  protected _isInitialized = false
  protected agentContext: AgentContext

  public readonly mdoc: MdocApi
  public readonly genericRecords: GenericRecordsApi
  public readonly dids: DidsApi
  public readonly w3cCredentials: W3cCredentialsApi
  public readonly sdJwtVc: SdJwtVcApi
  public readonly x509: X509Api
  public readonly kms: KeyManagementApi

  public readonly modules: AgentApi<WithoutDefaultModules<AgentModules>>

  public constructor(
    protected agentConfig: AgentConfig,
    public readonly dependencyManager: DependencyManager,
    private persistedModuleMetadata?: Record<string, Record<string, unknown> | undefined>
  ) {
    this.logger = this.agentConfig.logger

    this.logger.info('Creating agent with config', {
      agentConfig: agentConfig.toJSON(),
    })

    // Resolve instances after everything is registered
    this.eventEmitter = this.dependencyManager.resolve(EventEmitter)
    this.agentContext = this.dependencyManager.resolve(AgentContext)

    this.genericRecords = this.dependencyManager.resolve(GenericRecordsApi)
    this.dids = this.dependencyManager.resolve(DidsApi)
    this.w3cCredentials = this.dependencyManager.resolve(W3cCredentialsApi)
    this.sdJwtVc = this.dependencyManager.resolve(SdJwtVcApi)
    this.x509 = this.dependencyManager.resolve(X509Api)
    this.mdoc = this.dependencyManager.resolve(MdocApi)
    this.kms = this.dependencyManager.resolve(KeyManagementApi)

    const defaultApis = [
      this.genericRecords,
      this.dids,
      this.w3cCredentials,
      this.sdJwtVc,
      this.x509,
      this.mdoc,
      this.kms,
    ]

    // Set the api of the registered modules on the agent, excluding the default apis
    this.modules = getAgentApi(this.dependencyManager, defaultApis)
  }

  public get isInitialized() {
    return this._isInitialized
  }

  public async initialize() {
    if (this._isInitialized) {
      throw new CredoError(
        'Agent already initialized. Currently it is not supported to re-initialize an already initialized agent.'
      )
    }

    await this.dependencyManager.initializeAgentContext(this.agentContext, this.persistedModuleMetadata)

    // Make sure the storage is up to date
    const storageUpdateService = this.dependencyManager.resolve(StorageUpdateService)
    const isStorageUpToDate = await storageUpdateService.isUpToDate(this.agentContext)
    this.logger.info(`Agent storage is ${isStorageUpToDate ? '' : 'not '}up to date.`)

    if (!isStorageUpToDate && this.agentConfig.autoUpdateStorageOnStartup) {
      const updateAssistant = new UpdateAssistant(this)

      await updateAssistant.initialize()
      await updateAssistant.update({ backupBeforeStorageUpdate: this.agentConfig.backupBeforeStorageUpdate })
    } else if (!isStorageUpToDate) {
      const currentVersion = await storageUpdateService.getCurrentStorageVersion(this.agentContext)

      // Close agent context to prevent un-initialized agent with initialized agent context
      await this.dependencyManager.closeAgentContext(this.agentContext)

      throw new CredoError(
        // TODO: add link to where documentation on how to update can be found.
        `Current agent storage is not up to date. To prevent the framework state from getting corrupted the agent initialization is aborted. Make sure to update the agent storage (currently at ${currentVersion}) to the latest version (${UpdateAssistant.frameworkStorageVersion}). You can also downgrade your version of Credo.`
      )
    }
  }

  public get config() {
    return this.agentConfig
  }

  public get context() {
    return this.agentContext
  }
}
