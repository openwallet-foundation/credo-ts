import { EventEmitter } from 'events';

import { AgentConfig } from '../agent/AgentConfig';
import { ConnectionService, ConnectionStateChangedEvent } from '../protocols/connections/ConnectionService';
import { ConsumerRoutingService } from '../protocols/routing/ConsumerRoutingService';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionEventType } from '..';
import { createOutboundMessage } from '../protocols/helpers';

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

  /**
   * Get the event emitter for the connection service. Will emit state changed events
   * when the state of connections records changes.
   *
   * @returns event emitter for connection related actions
   */
  public get events(): EventEmitter {
    return this.connectionService;
  }

  public async createConnection(config?: {
    autoAcceptConnection?: boolean;
    alias?: string;
  }): Promise<{ invitation: ConnectionInvitationMessage; connectionRecord: ConnectionRecord }> {
    const { record: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    });

    // If agent has inbound connection, which means it's using a mediator, we need to create a route for newly created
    // connection verkey at mediator.
    if (this.agentConfig.inboundConnection) {
      this.consumerRoutingService.createRoute(connectionRecord.verkey);
    }

    return { connectionRecord, invitation };
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
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean;
      alias?: string;
    }
  ): Promise<ConnectionRecord> {
    let connection = await this.connectionService.processInvitation(invitation, {
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
   * Receive connection invitation encoded as url and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationUrl url containing a base64 encoded invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitationFromUrl(
    invitationUrl: string,
    config?: {
      autoAcceptConnection?: boolean;
      alias?: string;
    }
  ): Promise<ConnectionRecord> {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl);
    return this.receiveInvitation(invitation, config);
  }

  /**
   * Accept a connection invitation (by sending a connection request message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connections is enabled.
   *
   * @param connectionId the id of the connection for which to accept the invitation
   * @returns connection record
   */
  public async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, record: connectionRecord } = await this.connectionService.createRequest(connectionId);

    // If agent has inbound connection, which means it's using a mediator,
    // we need to create a route for newly created connection verkey at mediator.
    if (this.agentConfig.inboundConnection) {
      await this.consumerRoutingService.createRoute(connectionRecord.verkey);
    }

    const outbound = createOutboundMessage(connectionRecord, message, connectionRecord.invitation);
    await this.messageSender.sendMessage(outbound);

    return connectionRecord;
  }

  /**
   * Accept a connection request (by sending a connection response message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the request
   * @returns connection record
   */
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const { message, record: connectionRecord } = await this.connectionService.createResponse(connectionId);

    const outbound = createOutboundMessage(connectionRecord, message);
    await this.messageSender.sendMessage(outbound);

    return connectionRecord;
  }

  /**
   * Accept a connection response (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const { message, record: connectionRecord } = await this.connectionService.createTrustPing(connectionId);

    const outbound = createOutboundMessage(connectionRecord, message);
    await this.messageSender.sendMessage(outbound);

    return connectionRecord;
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete;
    };

    const connection = await this.connectionService.find(connectionId);
    if (connection && isConnected(connection)) return connection;

    return new Promise(resolve => {
      const listener = ({ connectionRecord }: ConnectionStateChangedEvent) => {
        if (isConnected(connectionRecord)) {
          this.events.off(ConnectionEventType.StateChanged, listener);
          resolve(connectionRecord);
        }
      };

      this.events.on(ConnectionEventType.StateChanged, listener);
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
}
