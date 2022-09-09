import type { Logger } from '../logger'
import type { DependencyManager } from '../plugins'
import type { AgentConfig } from './AgentConfig'
import type { TransportSession } from './TransportService'

import { AriesFrameworkError } from '../error'
import { BasicMessagesApi } from '../modules/basic-messages/BasicMessagesApi'
import { ConnectionsApi } from '../modules/connections/ConnectionsApi'
import { CredentialsApi } from '../modules/credentials/CredentialsApi'
import { DidsApi } from '../modules/dids/DidsApi'
import { DiscoverFeaturesApi } from '../modules/discover-features'
import { GenericRecordsApi } from '../modules/generic-records/GenericRecordsApi'
import { LedgerApi } from '../modules/ledger/LedgerApi'
import { OutOfBandApi } from '../modules/oob/OutOfBandApi'
import { ProofsApi } from '../modules/proofs/ProofsApi'
import { QuestionAnswerApi } from '../modules/question-answer/QuestionAnswerApi'
import { MediatorApi } from '../modules/routing/MediatorApi'
import { RecipientApi } from '../modules/routing/RecipientApi'
import { StorageUpdateService } from '../storage'
import { UpdateAssistant } from '../storage/migration/UpdateAssistant'
import { DEFAULT_UPDATE_CONFIG } from '../storage/migration/updates'
import { WalletApi } from '../wallet/WalletApi'
import { WalletError } from '../wallet/error'

import { EventEmitter } from './EventEmitter'
import { FeatureRegistry } from './FeatureRegistry'
import { MessageReceiver } from './MessageReceiver'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { AgentContext } from './context'

export abstract class BaseAgent {
  protected agentConfig: AgentConfig
  protected logger: Logger
  public readonly dependencyManager: DependencyManager
  protected eventEmitter: EventEmitter
  protected featureRegistry: FeatureRegistry
  protected messageReceiver: MessageReceiver
  protected transportService: TransportService
  protected messageSender: MessageSender
  protected _isInitialized = false
  protected agentContext: AgentContext

  public readonly connections: ConnectionsApi
  public readonly proofs: ProofsApi
  public readonly basicMessages: BasicMessagesApi
  public readonly genericRecords: GenericRecordsApi
  public readonly ledger: LedgerApi
  public readonly questionAnswer!: QuestionAnswerApi
  public readonly credentials: CredentialsApi
  public readonly mediationRecipient: RecipientApi
  public readonly mediator: MediatorApi
  public readonly discovery: DiscoverFeaturesApi
  public readonly dids: DidsApi
  public readonly wallet: WalletApi
  public readonly oob: OutOfBandApi

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

    this.registerDependencies(this.dependencyManager)

    // Resolve instances after everything is registered
    this.eventEmitter = this.dependencyManager.resolve(EventEmitter)
    this.featureRegistry = this.dependencyManager.resolve(FeatureRegistry)
    this.messageSender = this.dependencyManager.resolve(MessageSender)
    this.messageReceiver = this.dependencyManager.resolve(MessageReceiver)
    this.transportService = this.dependencyManager.resolve(TransportService)
    this.agentContext = this.dependencyManager.resolve(AgentContext)

    // We set the modules in the constructor because that allows to set them as read-only
    this.connections = this.dependencyManager.resolve(ConnectionsApi)
    this.credentials = this.dependencyManager.resolve(CredentialsApi) as CredentialsApi
    this.proofs = this.dependencyManager.resolve(ProofsApi) as ProofsApi
    this.mediator = this.dependencyManager.resolve(MediatorApi)
    this.mediationRecipient = this.dependencyManager.resolve(RecipientApi)
    this.basicMessages = this.dependencyManager.resolve(BasicMessagesApi)
    this.questionAnswer = this.dependencyManager.resolve(QuestionAnswerApi)
    this.genericRecords = this.dependencyManager.resolve(GenericRecordsApi)
    this.ledger = this.dependencyManager.resolve(LedgerApi)
    this.discovery = this.dependencyManager.resolve(DiscoverFeaturesApi)
    this.dids = this.dependencyManager.resolve(DidsApi)
    this.wallet = this.dependencyManager.resolve(WalletApi)
    this.oob = this.dependencyManager.resolve(OutOfBandApi)
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

  protected abstract registerDependencies(dependencyManager: DependencyManager): void
}
