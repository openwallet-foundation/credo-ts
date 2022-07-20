import type { Logger } from '../logger'
import type { DependencyManager } from '../plugins'
import type { AgentConfig } from './AgentConfig'
import type { AgentApi, DefaultAgentApi, DefaultAgentModules, ModulesMap } from './AgentModules'
import type { TransportSession } from './TransportService'

import { AriesFrameworkError } from '../error'
import { StorageUpdateService } from '../storage'
import { UpdateAssistant } from '../storage/migration/UpdateAssistant'
import { DEFAULT_UPDATE_CONFIG } from '../storage/migration/updates'
import { WalletError } from '../wallet/error'

import { getAgentApi } from './AgentModules'
import { EventEmitter } from './EventEmitter'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContext } from './context'

export abstract class BaseAgent<AgentModules extends ModulesMap = DefaultAgentModules> {
  protected agentConfig: AgentConfig
  protected logger: Logger
  public readonly dependencyManager: DependencyManager
  protected eventEmitter: EventEmitter
  protected messageReceiver: MessageReceiver
  protected transportService: TransportService
  protected messageSender: MessageSender
  protected _isInitialized = false
  protected agentContext: AgentContext

  public readonly api: DefaultAgentApi & AgentApi<AgentModules>

  public constructor(agentConfig: AgentConfig, dependencyManager: DependencyManager) {
    this.dependencyManager = dependencyManager

    this.agentConfig = agentConfig
    this.logger = this.agentConfig.logger

    this.logger.info('Creating agent with config', {
      agentConfig: agentConfig.toJSON(),
    })

    if (!this.agentConfig.walletConfig) {
      this.logger.warn(
        'Wallet config has not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    // Resolve instances after everything is registered
    this.eventEmitter = this.dependencyManager.resolve(EventEmitter)
    this.messageSender = this.dependencyManager.resolve(MessageSender)
    this.messageReceiver = this.dependencyManager.resolve(MessageReceiver)
    this.transportService = this.dependencyManager.resolve(TransportService)
    this.agentContext = this.dependencyManager.resolve(AgentContext)

    // Set the api of the registered modules on the agent
    this.api = getAgentApi(this.dependencyManager)
  }

  public get isInitialized() {
    return this._isInitialized && this.wallet.isInitialized
  }

  public async initialize() {
    const { publicDidSeed, walletConfig } = this.agentConfig

    if (this._isInitialized) {
      throw new AriesFrameworkError(
        'Agent already initialized. Currently it is not supported to re-initialize an already initialized agent.'
      )
    }

    if (!this.wallet.isInitialized && walletConfig) {
      await this.wallet.initialize(walletConfig)
    } else if (!this.wallet.isInitialized) {
      throw new WalletError(
        'Wallet config has not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the agent, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }

    // Make sure the storage is up to date
    const storageUpdateService = this.dependencyManager.resolve(StorageUpdateService)
    const isStorageUpToDate = await storageUpdateService.isUpToDate(this.agentContext)
    this.logger.info(`Agent storage is ${isStorageUpToDate ? '' : 'not '}up to date.`)

    if (!isStorageUpToDate && this.agentConfig.autoUpdateStorageOnStartup) {
      const updateAssistant = new UpdateAssistant(this, DEFAULT_UPDATE_CONFIG)

      await updateAssistant.initialize()
      await updateAssistant.update()
    } else if (!isStorageUpToDate) {
      const currentVersion = await storageUpdateService.getCurrentStorageVersion(this.agentContext)
      // Close wallet to prevent un-initialized agent with initialized wallet
      await this.wallet.close()
      throw new AriesFrameworkError(
        // TODO: add link to where documentation on how to update can be found.
        `Current agent storage is not up to date. ` +
          `To prevent the framework state from getting corrupted the agent initialization is aborted. ` +
          `Make sure to update the agent storage (currently at ${currentVersion}) to the latest version (${UpdateAssistant.frameworkStorageVersion}). ` +
          `You can also downgrade your version of Aries Framework JavaScript.`
      )
    }

    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.agentContext.wallet.initPublicDid({ seed: publicDidSeed })
    }
  }

  public get publicDid() {
    return this.agentContext.wallet.publicDid
  }

  /**
   * Receive a message. This should mainly be used for receiving connection-less messages.
   *
   * If you want to receive messages that originated from e.g. a transport make sure to use the {@link MessageReceiver}
   * for this. The `receiveMessage` method on the `Agent` class will associate the current context to the message, which
   * may not be what should happen (e.g. in case of multi tenancy).
   */
  public async receiveMessage(inboundMessage: unknown, session?: TransportSession) {
    return await this.messageReceiver.receiveMessage(inboundMessage, {
      session,
      contextCorrelationId: this.agentContext.contextCorrelationId,
    })
  }

  public get injectionContainer() {
    return this.dependencyManager.container
  }

  public get config() {
    return this.agentConfig
  }

  public get context() {
    return this.agentContext
  }
}
