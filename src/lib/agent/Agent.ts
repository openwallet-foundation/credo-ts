import logger from '../logger';
import { InitConfig } from '../types';
import { IndyWallet } from '../wallet/IndyWallet';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { TrustPingService } from '../protocols/trustping/TrustPingService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessageReceiver } from './MessageReceiver';
import { EnvelopeService } from './EnvelopeService';
import { LedgerService, SchemaTemplate, CredDefTemplate } from './LedgerService';
import { Dispatcher } from './Dispatcher';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { InvitationHandler } from '../handlers/connections/InvitationHandler';
import { ConnectionRequestHandler } from '../handlers/connections/ConnectionRequestHandler';
import { ConnectionResponseHandler } from '../handlers/connections/ConnectionResponseHandler';
import { AckMessageHandler } from '../handlers/acks/AckMessageHandler';
import { BasicMessageHandler } from '../handlers/basicmessage/BasicMessageHandler';
import { ForwardHandler } from '../handlers/routing/ForwardHandler';
import { TrustPingMessageHandler } from '../handlers/trustping/TrustPingMessageHandler';
import { TrustPingResponseMessageHandler } from '../handlers/trustping/TrustPingResponseMessageHandler';
import { MessagePickupHandler } from '../handlers/messagepickup/MessagePickupHandler';
import { KeylistUpdateHandler } from '../handlers/coordinatemediation/KeylistUpdateHandler';
import { MessageRepository } from '../storage/MessageRepository';
import { BasicMessageRecord } from '../storage/BasicMessageRecord';
import { Repository } from '../storage/Repository';
import { IndyStorageService } from '../storage/IndyStorageService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { AgentConfig } from './AgentConfig';
import { Wallet, DidConfig } from '../wallet/Wallet';
import { ProvisioningRecord } from '../storage/ProvisioningRecord';
import { ProvisioningService } from './ProvisioningService';
import { ConnectionsModule } from '../modules/ConnectionsModule';
import { RoutingModule } from '../modules/RoutingModule';
import { BasicMessagesModule } from '../modules/BasicMessagesModule';
import { CredentialsModule } from '../modules/Credentials';

export class Agent {
  inboundTransporter: InboundTransporter;
  wallet: Wallet;
  agentConfig: AgentConfig;
  messageReceiver: MessageReceiver;
  dispatcher: Dispatcher;
  messageSender: MessageSender;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  trustPingService: TrustPingService;
  messagePickupService: MessagePickupService;
  provisioningService: ProvisioningService;
  ledgerService: LedgerService;
  basicMessageRepository: Repository<BasicMessageRecord>;
  connectionRepository: Repository<ConnectionRecord>;
  provisioningRepository: Repository<ProvisioningRecord>;

  connections!: ConnectionsModule;
  routing!: RoutingModule;
  basicMessages!: BasicMessagesModule;
  credentials!: CredentialsModule;

  constructor(
    initialConfig: InitConfig,
    inboundTransporter: InboundTransporter,
    outboundTransporter: OutboundTransporter,
    indy: Indy,
    messageRepository?: MessageRepository
  ) {
    logger.logJson('Creating agent with config', initialConfig);
    this.wallet = new IndyWallet(initialConfig.walletConfig, initialConfig.walletCredentials, indy);
    const envelopeService = new EnvelopeService(this.wallet);

    this.agentConfig = new AgentConfig(initialConfig);
    this.messageSender = new MessageSender(envelopeService, outboundTransporter);
    this.dispatcher = new Dispatcher(this.messageSender);
    this.inboundTransporter = inboundTransporter;

    const storageService = new IndyStorageService(this.wallet);
    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
    this.provisioningRepository = new Repository<ProvisioningRecord>(ProvisioningRecord, storageService);

    this.provisioningService = new ProvisioningService(this.provisioningRepository);
    this.connectionService = new ConnectionService(this.wallet, this.agentConfig, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.messageSender, this.agentConfig);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);
    this.ledgerService = new LedgerService(this.wallet, indy);

    this.messageReceiver = new MessageReceiver(
      this.agentConfig,
      envelopeService,
      this.connectionService,
      this.dispatcher
    );

    this.registerHandlers();
    this.registerModules();
  }

  async init() {
    await this.wallet.init();

    const { publicDid, publicDidSeed } = this.agentConfig;
    if (publicDid && publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      this.wallet.initPublicDid(publicDid, publicDidSeed);
    }

    return this.inboundTransporter.start(this);
  }

  async connectToLedger(poolName: string, poolConfig: PoolConfig) {
    return this.ledgerService.connect(poolName, poolConfig);
  }

  async getPublicDidFromLedger(did: Did) {
    return this.ledgerService.getPublicDid(did);
  }

  async registerSchema(myDid: Did, schema: SchemaTemplate) {
    return this.ledgerService.registerSchema(myDid, schema);
  }

  async getSchemaFromLedger(myDid: Did, schemaId: SchemaId) {
    return this.ledgerService.getSchema(myDid, schemaId);
  }

  async registerDefinition(myDid: Did, credentialDefinitionTemplate: CredDefTemplate) {
    return this.ledgerService.registerDefinition(myDid, credentialDefinitionTemplate);
  }

  async getDefinitionFromLedger(myDid: Did, credDefId: CredDefId) {
    return this.ledgerService.getDefinitionFromLedger(myDid, credDefId);
  }

  async initPublicDid(did: Did, seed: string) {
    return this.wallet.initPublicDid2(did, seed);
  }

  getPublicDid() {
    return this.wallet.getPublicDid();
  }

  getAgencyUrl() {
    return this.agentConfig.agencyUrl;
  }

  async receiveMessage(inboundPackedMessage: any) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  async closeAndDeleteWallet() {
    await this.wallet.close();
    await this.wallet.delete();
  }

  private registerHandlers() {
    this.dispatcher.registerHandler(new InvitationHandler(this.connectionService, this.consumerRoutingService));
    this.dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService));
    this.dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService));
    this.dispatcher.registerHandler(new AckMessageHandler(this.connectionService));
    this.dispatcher.registerHandler(new BasicMessageHandler(this.connectionService, this.basicMessageService));
    this.dispatcher.registerHandler(new KeylistUpdateHandler(this.connectionService, this.providerRoutingService));
    this.dispatcher.registerHandler(new ForwardHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService));
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService));
    this.dispatcher.registerHandler(new MessagePickupHandler(this.connectionService, this.messagePickupService));
  }

  private registerModules() {
    this.connections = new ConnectionsModule(
      this.agentConfig,
      this.connectionService,
      this.consumerRoutingService,
      this.messageReceiver
    );

    this.routing = new RoutingModule(
      this.agentConfig,
      this.providerRoutingService,
      this.provisioningService,
      this.messagePickupService,
      this.connectionService,
      this.messageSender
    );

    this.basicMessages = new BasicMessagesModule(this.basicMessageService, this.messageSender);
  }
}
