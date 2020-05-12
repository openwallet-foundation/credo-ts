import logger from '../logger';
import { InitConfig } from '../types';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import { IndyWallet } from '../wallet/IndyWallet';
import { Connection } from '../protocols/connections/domain/Connection';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessageType as ConnectionsMessageType } from '../protocols/connections/messages';
import { MessageType as BasicMessageMessageType } from '../protocols/basicmessage/messages';
import { MessageType as RoutingMessageType } from '../protocols/routing/messages';
import { MessageType as TrustPingMessageType } from '../protocols/trustping/messages';
import { MessageType as MessagePickupType } from '../protocols/messagepickup/messages';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { Context } from './Context';
import { MessageReceiver } from './MessageReceiver';
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
import { TrustPingService } from '../protocols/trustping/TrustPingService';
import { TrustPingMessageHandler } from '../handlers/trustping/TrustPingMessageHandler';
import { TrustPingResponseMessageHandler } from '../handlers/trustping/TrustPingResponseMessageHandler';
import { BasicMessageRecord } from '../storage/BasicMessageRecord';
import { Repository } from '../storage/Repository';
import { IndyStorageService } from '../storage/IndyStorageService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { EnvelopeService } from './EnvelopeService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessagePickupHandler } from '../handlers/messagepickup/MessagePickupHandler';
import { MessageRepository } from '../storage/MessageRepository';

export class Agent {
  inboundTransporter: InboundTransporter;
  context: Context;
  messageReceiver: MessageReceiver;
  messageSender: MessageSender;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  trustPingService: TrustPingService;
  messagePickupService: MessagePickupService;
  handlers: { [key: string]: Handler } = {};
  basicMessageRepository: Repository<BasicMessageRecord>;
  connectionRepository: Repository<ConnectionRecord>;

  constructor(
    config: InitConfig,
    inboundTransporter: InboundTransporter,
    outboundTransporter: OutboundTransporter,
    indy: Indy,
    messageRepository?: MessageRepository
  ) {
    logger.logJson('Creating agent with config', config);

    const wallet = new IndyWallet(config.walletConfig, config.walletCredentials, indy);
    const storageService = new IndyStorageService(wallet);

    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);

    const envelopeService = new EnvelopeService(wallet);
    const messageSender = new MessageSender(envelopeService, outboundTransporter);

    this.inboundTransporter = inboundTransporter;

    this.context = {
      config,
      wallet,
      messageSender,
    };

    this.connectionService = new ConnectionService(this.context, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.context);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);

    this.registerHandlers();

    const dispatcher = new Dispatcher(this.handlers, messageSender);
    this.messageReceiver = new MessageReceiver(config, envelopeService, dispatcher);
    this.messageSender = messageSender;
  }

  async init() {
    await this.context.wallet.init();

    const { publicDid, publicDidSeed } = this.context.config;
    if (publicDid && publicDidSeed) {
      // If an agent has publicDid it will be used as routing key.
      this.context.wallet.initPublicDid(publicDid, publicDidSeed);
    }

    return this.inboundTransporter.start(this);
  }

  getPublicDid() {
    return this.context.wallet.getPublicDid();
  }

  async provision(agencyInvitation: any) {
    const connectionRequestOutboundMessage = await this.connectionService.acceptInvitation(agencyInvitation);
    const connectionResponseInboundMessage = await this.messageSender.sendAndReceive(connectionRequestOutboundMessage);
    const ackOutboundMessage = await this.connectionService.acceptResponse(connectionResponseInboundMessage);
    await this.messageSender.sendMessage(ackOutboundMessage);
    const { connection } = connectionRequestOutboundMessage;
    return connection;
  }

  async downloadMessages() {
    const inboundConnection = this.getInboundConnection();
    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection);
      const batchMessage = await this.messageSender.sendAndReceive(outboundMessage);
      logger.logJson('batchMessage', batchMessage);
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
    if (this.context.inboundConnection) {
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
    this.context.inboundConnection = { verkey: agencyVerkey, connection };
  }

  async sendMessageToConnection(connection: Connection, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection);
    await this.messageSender.sendMessage(outboundMessage);
  }

  getAgencyUrl() {
    return this.context.config.agencyUrl;
  }

  getInboundConnection() {
    return this.context.inboundConnection;
  }

  private registerHandlers() {
    const handlers = {
      [ConnectionsMessageType.ConnectionInvitation]: new InvitationHandler(
        this.connectionService,
        this.consumerRoutingService
      ),
      [ConnectionsMessageType.ConnectionRequest]: new ConnectionRequestHandler(this.connectionService),
      [ConnectionsMessageType.ConnectionResposne]: new ConnectionResponseHandler(this.connectionService),
      [ConnectionsMessageType.Ack]: new AckMessageHandler(this.connectionService),
      [BasicMessageMessageType.BasicMessage]: new BasicMessageHandler(this.connectionService, this.basicMessageService),
      [RoutingMessageType.RouteUpdateMessage]: new RouteUpdateHandler(
        this.connectionService,
        this.providerRoutingService
      ),
      [RoutingMessageType.ForwardMessage]: new ForwardHandler(this.providerRoutingService),
      [TrustPingMessageType.TrustPingMessage]: new TrustPingMessageHandler(
        this.trustPingService,
        this.connectionService
      ),
      [TrustPingMessageType.TrustPingResponseMessage]: new TrustPingResponseMessageHandler(this.trustPingService),
      [MessagePickupType.BatchPickup]: new MessagePickupHandler(this.connectionService, this.messagePickupService),
    };

    this.handlers = handlers;
  }
}
