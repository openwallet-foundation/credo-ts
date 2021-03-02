import type Indy from 'indy-sdk';
import logger from '../logger';
import { InitConfig } from '../types';
import { IndyWallet } from '../wallet/IndyWallet';
import { ConnectionService } from '../modules/connections/ConnectionService';
import { ProofService } from '../modules/proofs/ProofService';
import { ProviderRoutingService } from '../modules/routing/ProviderRoutingService';
import { ConsumerRoutingService } from '../modules/routing/ConsumerRoutingService';
import { BasicMessageService } from '../modules/basic-messages/BasicMessageService';
import { TrustPingService } from '../modules/connections/TrustPingService';
import { MessagePickupService } from '../modules/routing/MessagePickupService';
import { MessageReceiver } from './MessageReceiver';
import { EnvelopeService } from './EnvelopeService';
import { LedgerService } from '../modules/ledger/LedgerService';
import { Dispatcher } from './Dispatcher';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { ConnectionRequestHandler } from '../modules/connections/handlers/ConnectionRequestHandler';
import { ConnectionResponseHandler } from '../modules/connections/handlers/ConnectionResponseHandler';
import { AckMessageHandler } from '../modules/connections/handlers/AckMessageHandler';
import { BasicMessageHandler } from '../modules/basic-messages/handlers/BasicMessageHandler';
import { ForwardHandler } from '../modules/routing/handlers/ForwardHandler';
import { TrustPingMessageHandler } from '../modules/connections/handlers/TrustPingMessageHandler';
import { TrustPingResponseMessageHandler } from '../modules/connections/handlers/TrustPingResponseMessageHandler';
import { MessagePickupHandler } from '../modules/routing/handlers/MessagePickupHandler';
import { KeylistUpdateHandler } from '../modules/routing/handlers/KeylistUpdateHandler';
import { MessageRepository } from '../storage/MessageRepository';
import { BasicMessageRecord } from '../storage/BasicMessageRecord';
import { Repository } from '../storage/Repository';
import { IndyStorageService } from '../storage/IndyStorageService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { AgentConfig } from './AgentConfig';
import { Wallet } from '../wallet/Wallet';
import { ProvisioningRecord } from '../storage/ProvisioningRecord';
import { ProvisioningService } from './ProvisioningService';
import { ConnectionsModule } from '../modules/connections/ConnectionsModule';
import { RoutingModule } from '../modules/routing/RoutingModule';
import { BasicMessagesModule } from '../modules/basic-messages/BasicMessagesModule';
import { LedgerModule } from '../modules/ledger/LedgerModule';
import { CredentialsModule } from '../modules/credentials/CredentialsModule';
import { ProofsModule } from '../modules/proofs/ProofsModule';
import { CredentialService } from '../modules/credentials/CredentialService';
import { CredentialRecord } from '../storage/CredentialRecord';
import { OfferCredentialHandler } from '../modules/credentials/handlers/OfferCredentialHandler';
import { RequestCredentialHandler } from '../modules/credentials/handlers/RequestCredentialHandler';
import { IssueCredentialHandler } from '../modules/credentials/handlers/IssueCredentialHandler';
import { CredentialAckHandler } from '../modules/credentials/handlers/CredentialAckHandler';
import { RequestPresentationHandler } from '../modules/proofs/handlers/RequestPresentationHandler';
import { ProofRecord } from '../storage/ProofRecord';
import { ProposePresentationHandler } from '../modules/proofs/handlers/ProposePresentationHandler';
import { PresentationAckHandler } from '../modules/proofs/handlers/PresentationAckHandler';
import { PresentationHandler } from '../modules/proofs/handlers/PresentationHandler';
import { ProposeCredentialHandler } from '../modules/credentials/handlers/ProposeCredentialHandler';

export class Agent {
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
  protected trustPingService: TrustPingService;
  protected messagePickupService: MessagePickupService;
  protected provisioningService: ProvisioningService;
  protected ledgerService: LedgerService;
  protected credentialService: CredentialService;
  protected basicMessageRepository: Repository<BasicMessageRecord>;
  protected connectionRepository: Repository<ConnectionRecord>;
  protected provisioningRepository: Repository<ProvisioningRecord>;
  protected credentialRepository: Repository<CredentialRecord>;
  protected proofRepository: Repository<ProofRecord>;
  protected indy: typeof Indy;

  public inboundTransporter: InboundTransporter;

  public connections!: ConnectionsModule;
  public proof!: ProofsModule;
  public routing!: RoutingModule;
  public basicMessages!: BasicMessagesModule;
  public ledger!: LedgerModule;
  public credentials!: CredentialsModule;

  public constructor(
    initialConfig: InitConfig,
    inboundTransporter: InboundTransporter,
    outboundTransporter: OutboundTransporter,
    indy: typeof Indy,
    messageRepository?: MessageRepository
  ) {
    logger.logJson('Creating agent with config', initialConfig);
    this.wallet = new IndyWallet(initialConfig.walletConfig, initialConfig.walletCredentials, indy);
    const envelopeService = new EnvelopeService(this.wallet);

    this.indy = indy;

    this.agentConfig = new AgentConfig(initialConfig);
    this.messageSender = new MessageSender(envelopeService, outboundTransporter);
    this.dispatcher = new Dispatcher(this.messageSender);
    this.inboundTransporter = inboundTransporter;

    const storageService = new IndyStorageService(this.wallet);
    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
    this.provisioningRepository = new Repository<ProvisioningRecord>(ProvisioningRecord, storageService);
    this.credentialRepository = new Repository<CredentialRecord>(CredentialRecord, storageService);
    this.proofRepository = new Repository<ProofRecord>(ProofRecord, storageService);
    this.provisioningService = new ProvisioningService(this.provisioningRepository);
    this.connectionService = new ConnectionService(this.wallet, this.agentConfig, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.messageSender, this.agentConfig);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);
    this.ledgerService = new LedgerService(this.wallet, indy);
    this.credentialService = new CredentialService(
      this.wallet,
      this.credentialRepository,
      this.connectionService,
      this.ledgerService
    );
    this.proofService = new ProofService(this.proofRepository, this.ledgerService, this.wallet, indy);

    this.messageReceiver = new MessageReceiver(
      this.agentConfig,
      envelopeService,
      this.connectionService,
      this.dispatcher
    );

    this.registerHandlers();
    this.registerModules();
  }

  public async init() {
    await this.wallet.init();

    const { publicDidSeed, genesisPath, poolName } = this.agentConfig;
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

    return this.inboundTransporter.start(this);
  }

  public getPublicDid() {
    return this.wallet.getPublicDid();
  }

  public getMediatorUrl() {
    return this.agentConfig.mediatorUrl;
  }

  public async receiveMessage(inboundPackedMessage: unknown) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close();
    await this.wallet.delete();
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService, this.agentConfig));
    this.dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService, this.agentConfig));
    this.dispatcher.registerHandler(new AckMessageHandler(this.connectionService));
    this.dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService));
    this.dispatcher.registerHandler(new KeylistUpdateHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new ForwardHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService));
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService));
    this.dispatcher.registerHandler(new MessagePickupHandler(this.messagePickupService));
    this.dispatcher.registerHandler(new ProposeCredentialHandler(this.credentialService));
    this.dispatcher.registerHandler(new OfferCredentialHandler(this.credentialService));
    this.dispatcher.registerHandler(new RequestCredentialHandler(this.credentialService));
    this.dispatcher.registerHandler(new IssueCredentialHandler(this.credentialService));
    this.dispatcher.registerHandler(new CredentialAckHandler(this.credentialService));
    this.dispatcher.registerHandler(new ProposePresentationHandler(this.proofService));
    this.dispatcher.registerHandler(new RequestPresentationHandler(this.proofService));
    this.dispatcher.registerHandler(new PresentationHandler(this.proofService));
    this.dispatcher.registerHandler(new PresentationAckHandler(this.proofService));
  }

  protected registerModules() {
    this.connections = new ConnectionsModule(
      this.agentConfig,
      this.connectionService,
      this.consumerRoutingService,
      this.messageSender
    );

    this.proof = new ProofsModule(this.proofService, this.connectionService, this.messageSender);

    this.routing = new RoutingModule(
      this.agentConfig,
      this.providerRoutingService,
      this.provisioningService,
      this.messagePickupService,
      this.connectionService,
      this.messageSender
    );

    this.basicMessages = new BasicMessagesModule(this.basicMessageService, this.messageSender);
    this.ledger = new LedgerModule(this.wallet, this.ledgerService);

    this.credentials = new CredentialsModule(this.connectionService, this.credentialService, this.messageSender);
  }
}
