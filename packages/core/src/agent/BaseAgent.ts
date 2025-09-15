import type { Logger } from '../logger'
import { DidsApi } from '../modules/dids'
import { GenericRecordsApi } from '../modules/generic-records'
import { KeyManagementApi } from '../modules/kms'
import { MdocApi } from '../modules/mdoc'
import { SdJwtVcApi } from '../modules/sd-jwt-vc'
import { W3cCredentialsApi } from '../modules/vc/W3cCredentialsApi'
import { X509Api } from '../modules/x509'
import type { DependencyManager, Module } from '../plugins'
import type { AgentConfig } from './AgentConfig'
import type { AgentApi, EmptyModuleMap, ModuleApiInstance, ModulesMap, WithoutDefaultModules } from './AgentModules'

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

  /**
   * The DIDComm module, only available if the didcomm module is registered
   */
  public readonly didcomm: AgentModules['didcomm'] extends Module
    ? ModuleApiInstance<AgentModules['didcomm']>
    : undefined

  public readonly modules: AgentApi<WithoutDefaultModules<AgentModules>>

  public constructor(
    protected agentConfig: AgentConfig,
    public readonly dependencyManager: DependencyManager
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

    // Special case for DIDComm module, to expose it on the top-level of the agent.
    this.didcomm = ('didcomm' in this.modules ? this.modules.didcomm : undefined) as this['didcomm']
  }

  public get isInitialized() {
    return this._isInitialized
  }

  public get config() {
    return this.agentConfig
  }

  public get context() {
    return this.agentContext
  }
}
