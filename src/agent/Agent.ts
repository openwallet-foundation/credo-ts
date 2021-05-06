import { Logger } from '../logger'
import { InitConfig } from '../types'
import { IndyWallet } from '../wallet/IndyWallet'
import { MessageReceiver } from './MessageReceiver'
import { EnvelopeService } from './EnvelopeService'
import { ConnectionService, TrustPingService, ConnectionRecord, ConnectionState } from '../modules/connections'
import { CredentialService, CredentialRecord } from '../modules/credentials'
import { ProofService, ProofRecord } from '../modules/proofs'
import { MessagePickupService, MediationRecipientService, MediationRecord, MediatorService } from '../modules/routing'
import { BasicMessageService, BasicMessageRecord } from '../modules/basic-messages'
import { LedgerService } from '../modules/ledger'
import { Dispatcher } from './Dispatcher'
import { MessageSender } from './MessageSender'
import { InboundTransporter } from '../transport/InboundTransporter'
import { OutboundTransporter } from '../transport/OutboundTransporter'
import { MessageRepository } from '../storage/MessageRepository'
import { Repository } from '../storage/Repository'
import { IndyStorageService } from '../storage/IndyStorageService'
import { AgentConfig } from './AgentConfig'
import { Wallet } from '../wallet/Wallet'
import { ConnectionsModule } from '../modules/connections/ConnectionsModule'
import { CredentialsModule } from '../modules/credentials/CredentialsModule'
import { ProofsModule } from '../modules/proofs/ProofsModule'
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule'
import { LedgerModule } from '../modules/ledger/LedgerModule'
import EventEmitter from 'events'
import { RecipientModule } from '../modules/routing/RecipientModule'
import { MediatorModule } from '../modules/routing/MediatorModule'

export class Agent {
  protected logger: Logger
  protected eventEmitter: EventEmitter
  protected wallet: Wallet
  protected agentConfig: AgentConfig
  protected messageReceiver: MessageReceiver
  protected dispatcher: Dispatcher
  protected messageSender: MessageSender
  public inboundTransporter?: InboundTransporter

  protected connectionService: ConnectionService
  protected proofService: ProofService
  protected basicMessageService: BasicMessageService
  protected trustPingService: TrustPingService
  protected messagePickupService: MessagePickupService
  protected ledgerService: LedgerService
  protected credentialService: CredentialService
  protected mediationRecipientService: MediationRecipientService
  protected mediatorService: MediatorService
  protected basicMessageRepository: Repository<BasicMessageRecord>
  protected connectionRepository: Repository<ConnectionRecord>
  protected credentialRepository: Repository<CredentialRecord>
  protected proofRepository: Repository<ProofRecord>
  protected mediationRepository: Repository<MediationRecord>
  protected mediationRecipientRepository: Repository<MediationRecord>

  public connections!: ConnectionsModule
  public proofs!: ProofsModule
  public basicMessages!: BasicMessagesModule
  public ledger!: LedgerModule
  public credentials!: CredentialsModule
  public mediationRecipient!: RecipientModule
  public mediator!: MediatorModule

  public constructor(initialConfig: InitConfig, messageRepository?: MessageRepository) {
    this.agentConfig = new AgentConfig(initialConfig)
    this.logger = this.agentConfig.logger

    this.logger.info('Creating agent with config', {
      ...initialConfig,
      // Prevent large object being logged.
      // Will display true/false to indicate if value is present in config
      indy: initialConfig.indy != undefined,
      logger: initialConfig.logger != undefined,
    })

    this.eventEmitter = new EventEmitter()
    this.eventEmitter.addListener('agentMessage', async (payload) => {
      await this.receiveMessage(payload)
    })

    this.wallet = new IndyWallet(this.agentConfig)
    const envelopeService = new EnvelopeService(this.wallet, this.agentConfig)

    this.messageSender = new MessageSender(envelopeService)
    this.dispatcher = new Dispatcher(this.messageSender)

    const storageService = new IndyStorageService(this.wallet)
    // ---------------------- Repositories ----------------------
    this.mediationRepository = new Repository<MediationRecord>(
      MediationRecord,
      storageService as IndyStorageService<MediationRecord>
    )
    this.mediationRecipientRepository = new Repository<MediationRecord>(
      MediationRecord,
      storageService as IndyStorageService<MediationRecord>
    )
    this.basicMessageRepository = new Repository<BasicMessageRecord>(
      BasicMessageRecord,
      storageService as IndyStorageService<BasicMessageRecord>
    )
    this.connectionRepository = new Repository<ConnectionRecord>(
      ConnectionRecord,
      storageService as IndyStorageService<ConnectionRecord>
    )
    this.credentialRepository = new Repository<CredentialRecord>(
      CredentialRecord,
      storageService as IndyStorageService<CredentialRecord>
    )
    this.proofRepository = new Repository<ProofRecord>(ProofRecord, storageService as IndyStorageService<ProofRecord>)
    // ---------------------- Services ----------------------
    this.mediatorService = new MediatorService(
      this.messageSender,
      this.mediationRepository,
      this.agentConfig,
      this.wallet
    )
    this.mediationRecipientService = new MediationRecipientService(
      this.agentConfig,
      this.mediationRecipientRepository,
      this.messageSender,
      this.wallet
    )
    this.connectionService = new ConnectionService(
      this.wallet,
      this.agentConfig,
      this.connectionRepository,
      this.mediationRecipientService
    )
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository)
    this.trustPingService = new TrustPingService()
    this.messagePickupService = new MessagePickupService(messageRepository)
    this.ledgerService = new LedgerService(this.wallet, this.agentConfig)
    this.credentialService = new CredentialService(
      this.wallet,
      this.credentialRepository,
      this.connectionService,
      this.ledgerService,
      this.agentConfig
    )
    this.proofService = new ProofService(this.proofRepository, this.ledgerService, this.wallet, this.agentConfig)

    this.messageReceiver = new MessageReceiver(
      this.agentConfig,
      envelopeService,
      this.connectionService,
      this.dispatcher
    )

    this.registerModules()
  }

  public setInboundTransporter(inboundTransporter: InboundTransporter) {
    this.inboundTransporter = inboundTransporter
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.messageSender.setOutboundTransporter(outboundTransporter)
  }

  public async init() {
    await this.wallet.init()

    const { publicDidSeed, genesisPath, poolName } = this.agentConfig
    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.wallet.initPublicDid({ seed: publicDidSeed })
    }

    // If the genesisPath is provided in the config, we will automatically handle ledger connection
    // otherwise the framework consumer needs to do this manually
    if (genesisPath) {
      await this.ledger.connect(poolName, {
        genesis_txn: genesisPath,
      })
    }

    if (this.inboundTransporter) {
      await this.inboundTransporter.start(this)
    }
  }

  public get publicDid() {
    return this.wallet.publicDid
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close()
    await this.wallet.delete()
  }

  public async receiveMessage(inboundPackedMessage: unknown) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage)
  }

  public async getMediatorUrl() {
    const defaultMediator = await this.mediationRecipient.getDefaultMediator()
    if (defaultMediator) {
      return defaultMediator.endpoint ?? this.agentConfig.getEndpoint()
    }
    return this.agentConfig.getEndpoint()
  }
  protected registerModules() {
    this.connections = new ConnectionsModule(
      this.dispatcher,
      this.agentConfig,
      this.connectionService,
      this.trustPingService,
      this.messageSender
    )

    this.mediator = new MediatorModule(
      this.dispatcher,
      this.agentConfig,
      this.mediatorService,
      this.messagePickupService,
      this.connectionService,
      this.messageSender,
      this.eventEmitter
    )

    this.mediationRecipient = new RecipientModule(
      this.dispatcher,
      this.agentConfig,
      this.mediationRecipientService,
      this.messagePickupService,
      this.connectionService,
      this.messageSender,
      this.eventEmitter
    )

    this.credentials = new CredentialsModule(
      this.dispatcher,
      this.connectionService,
      this.credentialService,
      this.messageSender
    )

    this.proofs = new ProofsModule(this.dispatcher, this.proofService, this.connectionService, this.messageSender)

    this.basicMessages = new BasicMessagesModule(this.dispatcher, this.basicMessageService, this.messageSender)

    this.ledger = new LedgerModule(this.wallet, this.ledgerService)
  }
}
