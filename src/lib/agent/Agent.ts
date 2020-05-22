import logger from '../logger';
import { InitConfig } from '../types';
import { decodeInvitationFromUrl } from '../helpers';
import { IndyWallet } from '../wallet/IndyWallet';
import { Connection } from '../protocols/connections/domain/Connection';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { TrustPingService } from '../protocols/trustping/TrustPingService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessageReceiver } from './MessageReceiver';
import { EnvelopeService } from './EnvelopeService';
import { Dispatcher } from './Dispatcher';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { InvitationHandler } from '../handlers/connections/InvitationHandler';
import { ConnectionRequestHandler } from '../handlers/connections/ConnectionRequestHandler';
import { ConnectionResponseHandler } from '../handlers/connections/ConnectionResponseHandler';
import { AckMessageHandler } from '../handlers/acks/AckMessageHandler';
import { BasicMessageHandler } from '../handlers/basicmessage/BasicMessageHandler';
import { RouteUpdateHandler } from '../handlers/routing/RouteUpdateHandler';
import { ForwardHandler } from '../handlers/routing/ForwardHandler';
import { Handler } from '../handlers/Handler';
import { TrustPingMessageHandler } from '../handlers/trustping/TrustPingMessageHandler';
import { TrustPingResponseMessageHandler } from '../handlers/trustping/TrustPingResponseMessageHandler';
import { MessagePickupHandler } from '../handlers/messagepickup/MessagePickupHandler';
import { MessageRepository } from '../storage/MessageRepository';
import { BasicMessageRecord } from '../storage/BasicMessageRecord';
import { Repository } from '../storage/Repository';
import { IndyStorageService } from '../storage/IndyStorageService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { AgentConfig } from './AgentConfig';
import { Wallet } from '../wallet/Wallet';

export class Agent {
  inboundTransporter: InboundTransporter;
  wallet: Wallet;
  agentConfig: AgentConfig;
  messageReceiver: MessageReceiver;
  messageSender: MessageSender;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  trustPingService: TrustPingService;
  messagePickupService: MessagePickupService;
  handlers: Handler[] = [];
  basicMessageRepository: Repository<BasicMessageRecord>;
  connectionRepository: Repository<ConnectionRecord>;

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

    const storageService = new IndyStorageService(this.wallet);
    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);

    this.agentConfig = new AgentConfig(initialConfig);
    this.messageSender = new MessageSender(envelopeService, outboundTransporter);

    this.connectionService = new ConnectionService(this.wallet, this.agentConfig, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.messageSender, this.agentConfig);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);

    this.registerHandlers();

    const dispatcher = new Dispatcher(this.handlers, this.messageSender);
    this.messageReceiver = new MessageReceiver(this.agentConfig, envelopeService, dispatcher);
    this.inboundTransporter = inboundTransporter;
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

  getPublicDid() {
    return this.wallet.getPublicDid();
  }

  async provision(agencyConfiguration: AgencyConfiguration) {
    const { verkey, invitationUrl } = agencyConfiguration;
    const agencyInvitation = decodeInvitationFromUrl(invitationUrl);

    const connectionRequest = await this.connectionService.acceptInvitation(agencyInvitation);
    const connectionResponse = await this.messageSender.sendAndReceiveMessage(connectionRequest);
    const ack = await this.connectionService.acceptResponse(connectionResponse);
    await this.messageSender.sendMessage(ack);
    const { connection: agentConnectionAtAgency } = connectionRequest;

    if (!agentConnectionAtAgency) {
      throw new Error('Connection not found!');
    }
    await agentConnectionAtAgency.isConnected();
    logger.log('agentConnectionAtAgency\n', agentConnectionAtAgency);

    this.establishInbound(verkey, agentConnectionAtAgency);

    return agentConnectionAtAgency;
  }

  async downloadMessages() {
    const inboundConnection = this.getInboundConnection();
    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection);
      const batchMessage = await this.messageSender.sendAndReceiveMessage(outboundMessage);
      return batchMessage.message.messages;
    }
    return [];
  }

  async createConnection() {
    const connection = await this.connectionService.createConnectionWithInvitation();
    const { invitation } = connection;

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent has inbound connection, which means it's using agency, we need to create a route for newly created
    // connection verkey at agency.
    if (this.agentConfig.inboundConnection) {
      this.consumerRoutingService.createRoute(connection.verkey);
    }

    return connection;
  }

  async acceptInvitation(invitation: any) {
    const connection = (await this.messageReceiver.receiveMessage(invitation))?.connection;

    if (!connection) {
      throw new Error('No connection returned from receiveMessage');
    }

    if (!connection.verkey) {
      throw new Error('No verkey in connection returned from receiveMessage');
    }

    return connection;
  }

  async receiveMessage(inboundPackedMessage: any) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  async getConnections() {
    return this.connectionService.getConnections();
  }

  findConnectionByTheirKey(verkey: Verkey) {
    return this.connectionService.findByTheirKey(verkey);
  }

  getRoutes() {
    return this.providerRoutingService.getRoutes();
  }

  establishInbound(agencyVerkey: Verkey, connection: Connection) {
    this.agentConfig.establishInbound({ verkey: agencyVerkey, connection });
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection);
    await this.messageSender.sendMessage(outboundMessage);
  }

  getAgencyUrl() {
    return this.agentConfig.agencyUrl;
  }

  getInboundConnection() {
    return this.agentConfig.inboundConnection;
  }

  private registerHandlers() {
    const handlers = [
      new InvitationHandler(this.connectionService, this.consumerRoutingService),
      new ConnectionRequestHandler(this.connectionService),
      new ConnectionResponseHandler(this.connectionService),
      new AckMessageHandler(this.connectionService),
      new BasicMessageHandler(this.connectionService, this.basicMessageService),
      new RouteUpdateHandler(this.connectionService, this.providerRoutingService),
      new ForwardHandler(this.providerRoutingService),
      new TrustPingMessageHandler(this.trustPingService, this.connectionService),
      new TrustPingResponseMessageHandler(this.trustPingService),
      new MessagePickupHandler(this.connectionService, this.messagePickupService),
    ];

    this.handlers = handlers;
  }
}

interface AgencyConfiguration {
  verkey: Verkey;
  invitationUrl: string;
}
