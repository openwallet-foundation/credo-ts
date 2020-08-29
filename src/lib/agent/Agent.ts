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
import { LedgerService } from './LedgerService';
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
import { Wallet } from '../wallet/Wallet';
import { ProvisioningRecord } from '../storage/ProvisioningRecord';
import { ProvisioningService } from './ProvisioningService';
import { ConnectionsModule } from '../modules/ConnectionsModule';
import { RoutingModule } from '../modules/RoutingModule';
import { BasicMessagesModule } from '../modules/BasicMessagesModule';
import { LedgerModule } from '../modules/LedgerModule';

export class Agent {
  protected wallet: Wallet;
  protected agentConfig: AgentConfig;
  protected messageReceiver: MessageReceiver;
  protected dispatcher: Dispatcher;
  protected messageSender: MessageSender;
  protected connectionService: ConnectionService;
  protected basicMessageService: BasicMessageService;
  protected providerRoutingService: ProviderRoutingService;
  protected consumerRoutingService: ConsumerRoutingService;
  protected trustPingService: TrustPingService;
  protected messagePickupService: MessagePickupService;
  protected provisioningService: ProvisioningService;
  protected ledgerService: LedgerService;
  protected basicMessageRepository: Repository<BasicMessageRecord>;
  protected connectionRepository: Repository<ConnectionRecord>;
  protected provisioningRepository: Repository<ProvisioningRecord>;

  public inboundTransporter: InboundTransporter;

  public connections!: ConnectionsModule;
  public routing!: RoutingModule;
  public basicMessages!: BasicMessagesModule;
  public ledger!: LedgerModule;

  public constructor(
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

  public async init() {
    await this.wallet.init();

    const { publicDidSeed } = this.agentConfig;
    if (publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      this.wallet.initPublicDid({ seed: publicDidSeed });
    }

    return this.inboundTransporter.start(this);
  }

  public getPublicDid() {
    return this.wallet.getPublicDid();
  }

  public getAgencyUrl() {
    return this.agentConfig.agencyUrl;
  }

  public async receiveMessage(inboundPackedMessage: unknown) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  public async closeAndDeleteWallet() {
    await this.wallet.close();
    await this.wallet.delete();
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new InvitationHandler(this.connectionService, this.consumerRoutingService));
    this.dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService));
    this.dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService));
    this.dispatcher.registerHandler(new AckMessageHandler(this.connectionService));
    this.dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService));
    this.dispatcher.registerHandler(new KeylistUpdateHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new ForwardHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService));
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService));
    this.dispatcher.registerHandler(new MessagePickupHandler(this.messagePickupService));
  }

  protected registerModules() {
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
    this.ledger = new LedgerModule(this.wallet, this.ledgerService);
  }
}
