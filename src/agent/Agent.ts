import { Logger } from '../logger';
import { InboundConnection, InitConfig } from '../types';
import { IndyWallet } from '../wallet/IndyWallet';
import { MessageReceiver } from './MessageReceiver';
import { EnvelopeService } from './EnvelopeService';
import { ConnectionService, TrustPingService, ConnectionRecord, ConnectionState } from '../modules/connections';
import { CredentialService, CredentialRecord } from '../modules/credentials';
import { ProofService, ProofRecord } from '../modules/proofs';
import {
  ConsumerRoutingService,
  ProviderRoutingService,
  MessagePickupService,
  ProvisioningService,
  ProvisioningRecord,
} from '../modules/routing';
import { BasicMessageService, BasicMessageRecord } from '../modules/basic-messages';
import { LedgerService } from '../modules/ledger';
import { Dispatcher } from './Dispatcher';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { MessageRepository } from '../storage/MessageRepository';
import { Repository } from '../storage/Repository';
import { IndyStorageService } from '../storage/IndyStorageService';
import { AgentConfig } from './AgentConfig';
import { Wallet } from '../wallet/Wallet';
import { ConnectionsModule } from '../modules/connections/ConnectionsModule';
import { CredentialsModule } from '../modules/credentials/CredentialsModule';
import { ProofsModule } from '../modules/proofs/ProofsModule';
import { RoutingModule } from '../modules/routing/RoutingModule';
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule';
import { LedgerModule } from '../modules/ledger/LedgerModule';
import { MediationService } from '../modules/routing/services/MediationService';
import { MediationRecord } from '../modules/routing/repository/MediationRecord';

export class Agent {
  protected logger: Logger;
  protected wallet: Wallet;
  protected agentConfig: AgentConfig;
  protected messageReceiver: MessageReceiver;
  protected dispatcher: Dispatcher;
  protected messageSender: MessageSender;
  protected connectionService: ConnectionService;
  protected proofService: ProofService;
  protected basicMessageService: BasicMessageService;
  protected providerRoutingService: ProviderRoutingService;
  protected consumerRoutingService: ConsumerRoutingService;
  protected mediationService: MediationService;
  protected trustPingService: TrustPingService;
  protected messagePickupService: MessagePickupService;
  protected provisioningService: ProvisioningService;
  protected ledgerService: LedgerService;
  protected credentialService: CredentialService;
  protected basicMessageRepository: Repository<BasicMessageRecord>;
  protected connectionRepository: Repository<ConnectionRecord>;
  protected provisioningRepository: Repository<ProvisioningRecord>;
  protected mediationRepository: Repository<MediationRecord>;
  protected credentialRepository: Repository<CredentialRecord>;
  protected proofRepository: Repository<ProofRecord>;

  public inboundTransporter: InboundTransporter;

  public connections!: ConnectionsModule;
  public proofs!: ProofsModule;
  public routing!: RoutingModule;
  public basicMessages!: BasicMessagesModule;
  public ledger!: LedgerModule;
  public credentials!: CredentialsModule;

  public constructor(
    initialConfig: InitConfig,
    inboundTransporter: InboundTransporter,
    outboundTransporter: OutboundTransporter,
    messageRepository?: MessageRepository
  ) {
    this.agentConfig = new AgentConfig(initialConfig);
    this.logger = this.agentConfig.logger;

    this.logger.info('Creating agent with config', {
      ...initialConfig,
      // Prevent large object being logged.
      // Will display true/false to indicate if value is present in config
      indy: initialConfig.indy != undefined,
      logger: initialConfig.logger != undefined,
    });
    this.wallet = new IndyWallet(this.agentConfig);
    const envelopeService = new EnvelopeService(this.wallet, this.agentConfig);

    this.messageSender = new MessageSender(envelopeService, outboundTransporter);
    this.dispatcher = new Dispatcher(this.messageSender);
    this.inboundTransporter = inboundTransporter;

    const storageService = new IndyStorageService(this.wallet);
    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
    this.provisioningRepository = new Repository<ProvisioningRecord>(ProvisioningRecord, storageService);
    this.mediationRepository = new Repository<MediationRecord>(MediationRecord, storageService);
    this.credentialRepository = new Repository<CredentialRecord>(CredentialRecord, storageService);
    this.proofRepository = new Repository<ProofRecord>(ProofRecord, storageService);
    this.provisioningService = new ProvisioningService(this.provisioningRepository, this.agentConfig);
    this.connectionService = new ConnectionService(this.wallet, this.agentConfig, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.messageSender, this.agentConfig);
    this.mediationService = new MediationService(this.mediationRepository);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);
    this.ledgerService = new LedgerService(this.wallet, this.agentConfig);
    this.credentialService = new CredentialService(
      this.wallet,
      this.credentialRepository,
      this.connectionService,
      this.ledgerService,
      this.agentConfig
    );
    this.proofService = new ProofService(this.proofRepository, this.ledgerService, this.wallet, this.agentConfig);

    this.messageReceiver = new MessageReceiver(
      this.agentConfig,
      envelopeService,
      this.connectionService,
      this.dispatcher
    );

    this.registerModules();
  }

  public async init() {
    await this.wallet.init();

    const { publicDidSeed, genesisPath, poolName, mediatorRecordId } = this.agentConfig;
    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      await this.wallet.initPublicDid({ seed: publicDidSeed });
    }

    // If the genesisPath is provided in the config, we will automatically handle ledger connection
    // otherwise the framework consumer needs to do this manually
    if (genesisPath) {
      await this.ledger.connect(poolName, {
        genesis_txn: genesisPath,
      });
    }

    // If mediator record Id is provided, search for it and (if record exists) update other properties 
    // accordingly, overriding them if needed
    if (mediatorRecordId) {
      const mediationRecord = await this.mediationService.findById(mediatorRecordId);
      if (mediationRecord) {
        const connectionRecord = await this.connections.getById(mediationRecord.connectionId);
        if (connectionRecord) {
          this.setInboundConnection({
            connection: connectionRecord,
            verkey: mediationRecord.routingKeys[0],
          });
        }
      }
    }

    return this.inboundTransporter.start(this);
  }

  public get publicDid() {
    return this.wallet.publicDid;
  }

  public getMediatorUrl() {
    return this.agentConfig.mediatorUrl;
  }

  public async setInboundConnection(inbound: InboundConnection) {
    inbound.connection.assertState(ConnectionState.Complete);

    this.agentConfig.establishInbound({
      verkey: inbound.verkey,
      connection: inbound.connection,
    });
  }

  public async receiveMessage(inboundPackedMessage: unknown) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close();
    await this.wallet.delete();
  }

  protected registerModules() {
    this.connections = new ConnectionsModule(
      this.dispatcher,
      this.agentConfig,
      this.connectionService,
      this.trustPingService,
      this.consumerRoutingService,
      this.messageSender
    );

    this.credentials = new CredentialsModule(
      this.dispatcher,
      this.connectionService,
      this.credentialService,
      this.messageSender
    );

    this.proofs = new ProofsModule(this.dispatcher, this.proofService, this.connectionService, this.messageSender);

    this.routing = new RoutingModule(
      this.dispatcher,
      this.agentConfig,
      this.mediationService,
      this.providerRoutingService,
      this.provisioningService,
      this.messagePickupService,
      this.connectionService,
      this.messageSender
    );

    this.basicMessages = new BasicMessagesModule(this.dispatcher, this.basicMessageService, this.messageSender);

    this.ledger = new LedgerModule(this.wallet, this.ledgerService);
  }
}
