import logger from '../logger';
import { InitConfig } from '../types';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import { IndyWallet } from '../wallet/IndyWallet';
import { Connection } from '../protocols/connections/domain/Connection';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessageType as ConnectionsMessageType } from '../protocols/connections/messages';
import { MessageType as BasicMessageMessageType } from '../protocols/basicmessage/messages';
import { MessageType as RoutingMessageType } from '../protocols/routing/messages';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { Context } from './Context';
import { MessageReceiver } from './MessageReceiver';
import { Dispatcher } from './Dispatcher';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { InvitationHandler } from '../handlers/InvitationHandler';
import { ConnectionRequestHandler } from '../handlers/ConnectionRequestHandler';
import { ConnectionResponseHandler } from '../handlers/ConnectionResponseHandler';
import { AckMessageHandler } from '../handlers/AckMessageHandler';
import { BasicMessageHandler } from '../handlers/BasicMessageHandler';
import { RouteUpdateHandler } from '../handlers/RouteUpdateHandler';
import { ForwardHandler } from '../handlers/ForwardHandler';
import { Handler } from '../handlers/Handler';

export class Agent {
  inboundTransporter: InboundTransporter;
  context: Context;
  messageReceiver: MessageReceiver;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  handlers: { [key: string]: Handler } = {};

  constructor(config: InitConfig, inboundTransporter: InboundTransporter, outboundTransporter: OutboundTransporter) {
    logger.logJson('Creating agent with config', config);

    const wallet = new IndyWallet({ id: config.walletName }, { key: config.walletKey });
    const messageSender = new MessageSender(wallet, outboundTransporter);

    this.inboundTransporter = inboundTransporter;

    this.context = {
      config,
      wallet,
      messageSender,
    };

    this.connectionService = new ConnectionService(this.context);
    this.basicMessageService = new BasicMessageService();
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.context);

    this.registerHandlers();

    const dispatcher = new Dispatcher(this.handlers, messageSender);
    this.messageReceiver = new MessageReceiver(config, wallet, dispatcher);
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

  async createInvitationUrl() {
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

    return encodeInvitationToUrl(invitation);
  }

  async acceptInvitationUrl(invitationUrl: string) {
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const verkey = (await this.messageReceiver.receiveMessage(invitation))?.connection.verkey;

    if (!verkey) {
      throw new Error('No verkey has been return');
    }

    return verkey;
  }

  async receiveMessage(inboundPackedMessage: any) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  getConnections() {
    return this.connectionService.getConnections();
  }

  findConnectionByMyKey(verkey: Verkey) {
    return this.connectionService.findByVerkey(verkey);
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
    const outboundMessage = this.basicMessageService.send(message, connection);
    await this.context.messageSender.sendMessage(outboundMessage);
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
    };

    this.handlers = handlers;
  }
}
