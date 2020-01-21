import { injectable, inject, optional } from 'inversify';
import 'reflect-metadata';
import logger from '../logger';
import { InitConfig, InboundConnection, TYPES } from '../types';
import { encodeInvitationToUrl, decodeInvitationFromUrl } from '../helpers';
import { Connection } from '../protocols/connections/domain/Connection';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { Context } from './Context';
import { MessageReceiver } from './MessageReceiver';
import { MessageSender } from './MessageSender';
import { InboundTransporter } from '../transport/InboundTransporter';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { Handler } from '../handlers/Handler';
import { Wallet } from '../wallet/Wallet';

@injectable()
export class Agent {
  inboundTransporter: InboundTransporter;
  context: Context;
  messageReceiver: MessageReceiver;
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  providerRoutingService: ProviderRoutingService;
  consumerRoutingService: ConsumerRoutingService;
  handlers: { [key: string]: Handler } = {};

  constructor(
    @inject(TYPES.InitConfig) config: InitConfig,
    @inject(TYPES.InboundTransporter) inboundTransporter: InboundTransporter,
    @inject(TYPES.OutboundTransporter) outboundTransporter: OutboundTransporter,
    @inject(TYPES.Wallet) wallet: Wallet,
    @inject(TYPES.Context) context: Context,
    @inject(TYPES.ConnectionService) connectionService: ConnectionService,
    @inject(TYPES.BasicMessageService) basicMessageService: BasicMessageService,
    @inject(TYPES.ProviderRoutingService) providerRoutingService: ProviderRoutingService,
    @inject(TYPES.ConsumerRoutingService) consumerRoutingService: ConsumerRoutingService,
    @inject(TYPES.MessageReceiver) messageReceiver: MessageReceiver,
    @inject(TYPES.Handlers) handlers: { [key: string]: Handler }
  ) {
    logger.logJson('Creating agent with config', config);

    this.inboundTransporter = inboundTransporter;

    this.context = context;
    this.connectionService = connectionService;
    this.basicMessageService = basicMessageService;
    this.providerRoutingService = providerRoutingService;
    this.consumerRoutingService = consumerRoutingService;
    this.messageReceiver = messageReceiver;
    this.handlers = handlers;
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
    const verkey = await this.messageReceiver.receiveMessage(invitation);

    if (!verkey) {
      throw new Error('No verkey has been return');
    }

    return verkey;
  }

  async receiveMessage(inboundPackedMessage: any) {
    this.messageReceiver.receiveMessage(inboundPackedMessage);
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
}

@injectable()
export class ContextImpl implements Context {
  config: InitConfig;
  wallet: Wallet;
  inboundConnection?: InboundConnection | undefined;
  messageSender: MessageSender;

  public constructor(
    @inject(TYPES.InitConfig) config: InitConfig,
    @inject(TYPES.Wallet) wallet: Wallet,
    @inject(TYPES.InboundConnection) @optional() inboundConnection: InboundConnection,
    @inject(TYPES.MessageSender) messageSender: MessageSender
  ) {
    this.config = config;
    this.wallet = wallet;
    this.inboundConnection = inboundConnection;
    this.messageSender = messageSender;
  }
}
