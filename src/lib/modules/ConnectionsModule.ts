// eslint-disable-next-line
// @ts-ignore
import { poll } from 'await-poll';
import { EventEmitter } from 'events';
import { AgentConfig } from '../agent/AgentConfig';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { MessageReceiver } from '../agent/MessageReceiver';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';

export class ConnectionsModule {
  agentConfig: AgentConfig;
  connectionService: ConnectionService;
  consumerRoutingService: ConsumerRoutingService;
  messageReceiver: MessageReceiver;

  constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    consumerRoutingService: ConsumerRoutingService,
    messageReceiver: MessageReceiver
  ) {
    this.agentConfig = agentConfig;
    this.connectionService = connectionService;
    this.consumerRoutingService = consumerRoutingService;
    this.messageReceiver = messageReceiver;
  }

  async createConnection() {
    const { invitation, connection } = await this.connectionService.createConnectionWithInvitation();

    if (!invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent has inbound connection, which means it's using agency, we need to create a route for newly created
    // connection verkey at agency.
    if (this.agentConfig.inboundConnection) {
      this.consumerRoutingService.createRoute(connection.verkey);
    }

    return { invitation, connection };
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

  async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const connectionRecord = await poll(
      () => this.find(connectionId),
      (c: ConnectionRecord) => c.state !== ConnectionState.COMPLETE,
      100
    );
    return connectionRecord;
  }

  async getAll() {
    return this.connectionService.getConnections();
  }

  async find(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.find(connectionId);
  }

  async findConnectionByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByVerkey(verkey);
  }

  async findConnectionByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirKey(verkey);
  }

  events(): EventEmitter {
    return this.connectionService;
  }
}
