import { EventEmitter } from 'events';

import { AgentConfig } from '../agent/AgentConfig';
import { ConnectionService, ConnectionStateChangedEvent } from '../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionEventType } from '..';
import { JsonTransformer } from '../utils/JsonTransformer';

export class ConnectionsModule {
  private agentConfig: AgentConfig;
  private connectionService: ConnectionService;
  private consumerRoutingService: ConsumerRoutingService;
  private messageSender: MessageSender;

  public constructor(
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    consumerRoutingService: ConsumerRoutingService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig;
    this.connectionService = connectionService;
    this.consumerRoutingService = consumerRoutingService;
    this.messageSender = messageSender;
  }

  public async createConnection(config?: { autoAcceptConnection?: boolean; alias?: string }) {
    const connection = await this.connectionService.createConnectionWithInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    });

    if (!connection.invitation) {
      throw new Error('Connection has no invitation assigned.');
    }

    // If agent has inbound connection, which means it's using a mediator, we need to create a route for newly created
    // connection verkey at mediator.
    if (this.agentConfig.inboundConnection) {
      this.consumerRoutingService.createRoute(connection.verkey);
    }

    return connection;
  }

  /**
   * Receive connection invitation and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationJson json object containing the invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitation(
    invitationJson: Record<string, unknown>,
    config?: {
      autoAcceptConnection?: boolean;
      alias?: string;
    }
  ): Promise<ConnectionRecord> {
    const invitationMessage = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage);

    let connection = await this.connectionService.processInvitation(invitationMessage, {
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    });

    // if auto accept is enabled (either on the record or the global agent config)
    // we directly send a connection request
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      connection = await this.acceptInvitation(connection.id);
    }

    return connection;
  }

  /**
   * Accept a connection invitation (by sending a connection request message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connections is enabled.
   *
   * @param connectionId the id of the connection for which to accept the invitation
   * @returns connection record
   */
  public async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const outboundMessage = await this.connectionService.createRequest(connectionId);

    // If agent has inbound connection, which means it's using a mediator,
    // we need to create a route for newly created connection verkey at mediator.
    if (this.agentConfig.inboundConnection) {
      await this.consumerRoutingService.createRoute(outboundMessage.connection.verkey);
    }

    await this.messageSender.sendMessage(outboundMessage);

    return outboundMessage.connection;
  }

  /**
   * Accept a connection request (by sending a connection response message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the request
   * @returns connection record
   */
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const outboundMessage = await this.connectionService.createResponse(connectionId);
    await this.messageSender.sendMessage(outboundMessage);

    return outboundMessage.connection;
  }

  /**
   * Accept a connection response (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const outboundMessage = await this.connectionService.createTrustPing(connectionId);
    await this.messageSender.sendMessage(outboundMessage);

    return outboundMessage.connection;
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete;
    };

    const connection = await this.connectionService.find(connectionId);
    if (connection && isConnected(connection)) return connection;

    return new Promise(resolve => {
      const listener = ({ connection }: ConnectionStateChangedEvent) => {
        if (isConnected(connection)) {
          this.events().off(ConnectionEventType.StateChanged, listener);
          resolve(connection);
        }
      };

      this.events().on(ConnectionEventType.StateChanged, listener);
    });
  }

  public async getAll() {
    return this.connectionService.getConnections();
  }

  public async find(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.find(connectionId);
  }

  public async findConnectionByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByVerkey(verkey);
  }

  public async findConnectionByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirKey(verkey);
  }

  public events(): EventEmitter {
    return this.connectionService;
  }
}
