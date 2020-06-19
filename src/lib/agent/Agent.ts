import { EventEmitter } from 'events';
import logger from '../logger';
import { InitConfig } from '../types';
import { decodeInvitationFromUrl } from '../helpers';
import { IndyWallet } from '../wallet/IndyWallet';
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
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { ProvisioningRecord } from '../storage/ProvisioningRecord';
import { ProvisioninService } from './ProvisioningService';
import { ConnectionsModule } from '../modules/ConnectionsModule';

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
  provisioningService: ProvisioninService;
  handlers: Handler[] = [];
  basicMessageRepository: Repository<BasicMessageRecord>;
  connectionRepository: Repository<ConnectionRecord>;
  provisioningRepository: Repository<ProvisioningRecord>;

  connections: ConnectionsModule;

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
    this.messageReceiver = new MessageReceiver(this.agentConfig, envelopeService, this.dispatcher);
    this.inboundTransporter = inboundTransporter;

    const storageService = new IndyStorageService(this.wallet);
    this.basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService);
    this.connectionRepository = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
    this.provisioningRepository = new Repository<ProvisioningRecord>(ProvisioningRecord, storageService);

    this.provisioningService = new ProvisioninService(this.provisioningRepository);
    this.connectionService = new ConnectionService(this.wallet, this.agentConfig, this.connectionRepository);
    this.basicMessageService = new BasicMessageService(this.basicMessageRepository);
    this.providerRoutingService = new ProviderRoutingService();
    this.consumerRoutingService = new ConsumerRoutingService(this.messageSender, this.agentConfig);
    this.trustPingService = new TrustPingService();
    this.messagePickupService = new MessagePickupService(messageRepository);

    this.registerHandlers();

    this.connections = new ConnectionsModule(
      this.agentConfig,
      this.connectionService,
      this.consumerRoutingService,
      this.messageReceiver
    );
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
    let provisioningRecord = await this.provisioningService.find();

    if (!provisioningRecord) {
      logger.log('There is no provisioning. Creating connection with agency...');
      const { verkey, invitationUrl } = agencyConfiguration;
      const agencyInvitation = decodeInvitationFromUrl(invitationUrl);

      const connectionRequest = await this.connectionService.acceptInvitation(agencyInvitation);
      const connectionResponse = await this.messageSender.sendAndReceiveMessage(connectionRequest);
      const ack = await this.connectionService.acceptResponse(connectionResponse);
      await this.messageSender.sendMessage(ack);

      const provisioningProps = {
        agencyConnectionVerkey: connectionRequest.connection.verkey,
        agencyPublicVerkey: verkey,
      };
      provisioningRecord = await this.provisioningService.create(provisioningProps);
      logger.log('Provisioning record has been saved.');
    }

    logger.log('Provisioning record:', provisioningRecord);

    const agentConnectionAtAgency = await this.connectionService.findByVerkey(
      provisioningRecord.agencyConnectionVerkey
    );

    if (!agentConnectionAtAgency) {
      throw new Error('Connection not found!');
    }
    logger.log('agentConnectionAtAgency', agentConnectionAtAgency);

    if (agentConnectionAtAgency.state !== ConnectionState.COMPLETE) {
      throw new Error('Connection has not been established.');
    }

    this.establishInbound(provisioningRecord.agencyPublicVerkey, agentConnectionAtAgency);

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

  async receiveMessage(inboundPackedMessage: any) {
    return await this.messageReceiver.receiveMessage(inboundPackedMessage);
  }

  getRoutes() {
    return this.providerRoutingService.getRoutes();
  }

  establishInbound(agencyVerkey: Verkey, connection: ConnectionRecord) {
    this.agentConfig.establishInbound({ verkey: agencyVerkey, connection });
  }

  async sendMessageToConnection(connection: ConnectionRecord, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection);
    await this.messageSender.sendMessage(outboundMessage);
  }

  getAgencyUrl() {
    return this.agentConfig.agencyUrl;
  }

  getInboundConnection() {
    return this.agentConfig.inboundConnection;
  }

  async closeAndDeleteWallet() {
    await this.wallet.close();
    await this.wallet.delete();
  }

  events(): { connections: EventEmitter; basicMessages: EventEmitter } {
    return {
      connections: this.connectionService,
      basicMessages: this.basicMessageService,
    };
  }

  private registerHandlers() {
    this.dispatcher.registerHandler(new InvitationHandler(this.connectionService, this.consumerRoutingService));
    this.dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService));
    this.dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService));
    this.dispatcher.registerHandler(new AckMessageHandler(this.connectionService));
    this.dispatcher.registerHandler(new BasicMessageHandler(this.connectionService, this.basicMessageService));
    this.dispatcher.registerHandler(new RouteUpdateHandler(this.connectionService, this.providerRoutingService));
    this.dispatcher.registerHandler(new ForwardHandler(this.providerRoutingService));
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService));
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService));
    this.dispatcher.registerHandler(new MessagePickupHandler(this.connectionService, this.messagePickupService));
  }
}

interface AgencyConfiguration {
  verkey: Verkey;
  invitationUrl: string;
}
