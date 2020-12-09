import { EventEmitter } from 'events';
import { validateOrReject } from 'class-validator';

import { OutboundMessage } from '../../types';
import { AgentConfig } from '../../agent/AgentConfig';
import { createOutboundMessage } from '../helpers';
import { ConnectionState } from './domain/ConnectionState';
import { DidDoc, Service, PublicKey, PublicKeyType, Authentication } from './domain/DidDoc';
import { ConnectionRecord, ConnectionTags } from '../../storage/ConnectionRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';
import { ConnectionInvitationMessage } from './ConnectionInvitationMessage';
import { ConnectionRequestMessage } from './ConnectionRequestMessage';
import { ConnectionResponseMessage } from './ConnectionResponseMessage';
import { signData, unpackAndVerifySignatureDecorator } from '../../decorators/signature/SignatureDecoratorUtils';
import { Connection } from './domain/Connection';
import { AckMessage } from './AckMessage';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import { ConnectionRole } from './domain/ConnectionRole';
import { TrustPingMessage } from '../trustping/TrustPingMessage';
import { JsonTransformer } from '../../utils/JsonTransformer';

enum EventType {
  StateChanged = 'stateChanged',
}

interface ConnectionStateChangedEvent {
  connection: ConnectionRecord;
  prevState: ConnectionState;
}

class ConnectionService extends EventEmitter {
  private wallet: Wallet;
  private config: AgentConfig;
  private connectionRepository: Repository<ConnectionRecord>;

  public constructor(wallet: Wallet, config: AgentConfig, connectionRepository: Repository<ConnectionRecord>) {
    super();
    this.wallet = wallet;
    this.config = config;
    this.connectionRepository = connectionRepository;
  }

  /**
   * Create a new connection record containing a connection invitation message
   *
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async createConnectionWithInvitation(config?: {
    autoAcceptConnection?: boolean;
    alias?: string;
  }): Promise<ConnectionRecord> {
    // TODO: public did, multi use
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Inviter,
      state: ConnectionState.Invited,
      alias: config?.alias,
      autoAcceptConnection: config?.autoAcceptConnection,
    });

    const { didDoc } = connectionRecord;
    const invitation = new ConnectionInvitationMessage({
      label: this.config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    });

    connectionRecord.invitation = invitation;
    this.connectionRepository.update(connectionRecord);

    return connectionRecord;
  }

  /**
   * Process a received invitation message. This will not accept the invitation
   * or send an invitation request message. It will only create a connection record
   * with all the information about the invitation stored. Use {@link ConnectionService#createRequest}
   * after calling this function to create a connection request.
   *
   * @param invitation the invitation message to process
   * @returns new connection record.
   */
  public async processInvitation(
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean;
      alias?: string;
    }
  ): Promise<ConnectionRecord> {
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Invitee,
      state: ConnectionState.Invited,
      alias: config?.alias,
      autoAcceptConnection: config?.autoAcceptConnection,
      invitation,
      tags: {
        invitationKey: invitation.recipientKeys && invitation.recipientKeys[0],
      },
    });

    return connectionRecord;
  }

  /**
   * Create a connectino request message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection request
   * @returns outbound message contaning connection request
   */
  public async createRequest(connectionId: string): Promise<OutboundMessage<ConnectionRequestMessage>> {
    const connectionRecord = await this.connectionRepository.find(connectionId);

    // TODO: should we also check for role? In theory we can only send request if we are the invitee
    if (connectionRecord.state !== ConnectionState.Invited) {
      throw new Error('Connection must be in Invited state to send connection request message');
    }

    const connectionRequest = new ConnectionRequestMessage({
      label: this.config.label,
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
    });

    await this.updateState(connectionRecord, ConnectionState.Requested);

    // TODO: remove invitation from this call. Will do when replacing outbound message
    return createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation);
  }

  /**
   * Process a received connection request message. This will not accept the connection request
   * or send a connection response message. It will only update the existing connection record
   * with all the new information from the connection request message. Use {@link ConnectionService#createResponse}
   * after calling this function to create a connection respone.
   *
   * @param messageContext the message context containing a connetion request message
   * @returns updated connection record
   */
  public async processRequest(
    messageContext: InboundMessageContext<ConnectionRequestMessage>
  ): Promise<ConnectionRecord> {
    const { message, connection: connectionRecord, recipientVerkey } = messageContext;

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`);
    }

    // TODO: validate using class-validator
    if (!message.connection) {
      throw new Error('Invalid message');
    }

    connectionRecord.theirDid = message.connection.did;
    connectionRecord.theirDidDoc = message.connection.didDoc;

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with id ${connectionRecord.id} has no recipient keys.`);
    }

    connectionRecord.tags = {
      ...connectionRecord.tags,
      theirKey: connectionRecord.theirKey,
      threadId: message.id,
    };

    await this.updateState(connectionRecord, ConnectionState.Requested);

    return connectionRecord;
  }

  /**
   * Create a connection response message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection response
   * @returns outbound message contaning connection response
   */
  public async createResponse(connectionId: string): Promise<OutboundMessage<ConnectionResponseMessage>> {
    const connectionRecord = await this.connectionRepository.find(connectionId);

    // TODO: should we also check for role? In theory we can only send response if we are the inviter
    if (connectionRecord.state !== ConnectionState.Requested) {
      throw new Error('Connection must be in Requested state to send connection response message');
    }

    const connection = new Connection({
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
    });

    const connectionJson = JsonTransformer.toJSON(connection);

    const connectionResponse = new ConnectionResponseMessage({
      threadId: connectionRecord.tags.threadId!,
      connectionSig: await signData(connectionJson, this.wallet, connectionRecord.verkey),
    });

    await this.updateState(connectionRecord, ConnectionState.Responded);
    return createOutboundMessage(connectionRecord, connectionResponse);
  }

  /**
   * Process a received connection response message. This will not accept the connection request
   * or send a connection acknowledgement message. It will only update the existing connection record
   * with all the new information from the connection response message. Use {@link ConnectionService#createTrustPing}
   * after calling this function to create a trust ping message.
   *
   * @param messageContext the message context containing a connetion response message
   * @returns updated connection record
   */
  public async processResponse(
    messageContext: InboundMessageContext<ConnectionResponseMessage>
  ): Promise<ConnectionRecord> {
    const { message, connection: connectionRecord, recipientVerkey } = messageContext;

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`);
    }

    const connectionJson = await unpackAndVerifySignatureDecorator(message.connectionSig, this.wallet);

    const connection = JsonTransformer.fromJSON(connectionJson, Connection);
    await validateOrReject(connection);

    // Per the Connection RFC we must check if the key used to sign the connection~sig is the same key
    // as the recipient key(s) in the connection invitation message
    const signerVerkey = message.connectionSig.signer;
    const invitationKey = connectionRecord.tags.invitationKey;
    if (signerVerkey !== invitationKey) {
      throw new Error('Connection in connection response is not signed with same key as recipient key in invitation');
    }

    connectionRecord.theirDid = connection.did;
    connectionRecord.theirDidDoc = connection.didDoc;

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with id ${connectionRecord.id} has no recipient keys.`);
    }

    connectionRecord.tags = {
      ...connectionRecord.tags,
      theirKey: connectionRecord.theirKey,
      threadId: message.getThreadId(),
    };

    await this.updateState(connectionRecord, ConnectionState.Responded);
    return connectionRecord;
  }

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a trust ping message
   * @returns outbound message contaning trust ping message
   */
  public async createTrustPing(connectionId: string) {
    const connectionRecord = await this.connectionRepository.find(connectionId);

    if (connectionRecord.state !== ConnectionState.Responded && connectionRecord.state !== ConnectionState.Complete) {
      throw new Error('Connection must be in Responded or Complete state to send ack message');
    }

    // TODO:
    //  - create ack message
    //  - allow for options
    //  - maybe this shouldn't be in the connection service?
    const response = new TrustPingMessage();

    await this.updateState(connectionRecord, ConnectionState.Complete);

    return createOutboundMessage(connectionRecord, response);
  }

  /**
   * Process a received ack message. This will update the state of the connection
   * to Completed if this is not already the case.
   *
   * @param messageContext the message context containing an ack message
   * @returns updated connection record
   */
  public async processAck(messageContext: InboundMessageContext<AckMessage>): Promise<ConnectionRecord> {
    const connection = messageContext.connection;

    if (!connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === ConnectionState.Responded && connection.role === ConnectionRole.Inviter) {
      await this.updateState(connection, ConnectionState.Complete);
    }

    return connection;
  }

  public async updateState(connectionRecord: ConnectionRecord, newState: ConnectionState) {
    const prevState = connectionRecord.state;
    connectionRecord.state = newState;
    await this.connectionRepository.update(connectionRecord);

    const event: ConnectionStateChangedEvent = {
      connection: connectionRecord,
      prevState,
    };

    this.emit(EventType.StateChanged, event);
  }

  private async createConnection(options: {
    role: ConnectionRole;
    state: ConnectionState;
    invitation?: ConnectionInvitationMessage;
    alias?: string;
    autoAcceptConnection?: boolean;
    tags?: ConnectionTags;
  }): Promise<ConnectionRecord> {
    const [did, verkey] = await this.wallet.createDid();
    const publicKey = new PublicKey(`${did}#1`, PublicKeyType.ED25519_SIG_2018, did, verkey);
    const service = new Service(
      `${did};indy`,
      this.config.getEndpoint(),
      [verkey],
      this.config.getRoutingKeys(),
      0,
      'IndyAgent'
    );
    const auth = new Authentication(publicKey);
    const didDoc = new DidDoc(did, [auth], [publicKey], [service]);

    const connectionRecord = new ConnectionRecord({
      did,
      didDoc,
      verkey,
      state: options.state,
      role: options.role,
      tags: {
        verkey,
        ...options.tags,
      },
      invitation: options.invitation,
      alias: options.alias,
      autoAcceptConnection: options.autoAcceptConnection,
    });

    await this.connectionRepository.save(connectionRecord);
    return connectionRecord;
  }

  public async getConnections() {
    return this.connectionRepository.findAll();
  }

  public async find(connectionId: string): Promise<ConnectionRecord | null> {
    try {
      const connection = await this.connectionRepository.find(connectionId);

      return connection;
    } catch {
      // connection not found.
      return null;
    }
  }

  public async findByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    const connectionRecords = await this.connectionRepository.findByQuery({ verkey });

    if (connectionRecords.length > 1) {
      throw new Error(`There is more than one connection for given verkey ${verkey}`);
    }

    if (connectionRecords.length < 1) {
      return null;
    }

    return connectionRecords[0];
  }

  public async findByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    const connectionRecords = await this.connectionRepository.findByQuery({ theirKey: verkey });

    if (connectionRecords.length > 1) {
      throw new Error(`There is more than one connection for given verkey ${verkey}`);
    }

    if (connectionRecords.length < 1) {
      return null;
    }

    return connectionRecords[0];
  }
}

export { ConnectionService, EventType, ConnectionStateChangedEvent };
