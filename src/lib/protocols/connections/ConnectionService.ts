import { InitConfig, Message, InboundMessage } from '../../types';
import {
  createInvitationMessage,
  createConnectionRequestMessage,
  createConnectionResponseMessage,
  createAckMessage,
} from './messages';
import { Context } from '../../agent/Context';
import { createOutboundMessage } from '../helpers';
import { Connection } from './domain/Connection';
import { ConnectionState } from './domain/ConnectionState';
import { DidDoc, Service, PublicKey, PublicKeyType, Authentication } from './domain/DidDoc';
import { createTrustPingMessage } from '../trustping/messages';

class ConnectionService {
  context: Context;
  connections: Connection[] = [];

  constructor(context: Context) {
    this.context = context;
  }

  async createConnectionWithInvitation(): Promise<Connection> {
    const connection = await this.createConnection();
    const invitationDetails = this.createInvitationDetails(this.context.config, connection);
    const invitation = await createInvitationMessage(invitationDetails);
    connection.invitation = invitation;
    connection.updateState(ConnectionState.INVITED);
    return connection;
  }

  async acceptInvitation(invitation: Message) {
    const connection = await this.createConnection();
    const connectionRequest = createConnectionRequestMessage(connection, this.context.config.label);
    connection.updateState(ConnectionState.REQUESTED);
    return createOutboundMessage(connection, connectionRequest, invitation);
  }

  async acceptRequest(inboundMessage: InboundMessage) {
    const { wallet } = this.context;
    const { message, recipient_verkey } = inboundMessage;
    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!message.connection) {
      throw new Error('Invalid message');
    }

    const requestConnection = message.connection;
    connection.updateDidExchangeConnection(requestConnection);

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const connectionResponse = createConnectionResponseMessage(connection, message['@id']);
    const signedConnectionResponse = await wallet.sign(connectionResponse, 'connection', connection.verkey);
    connection.updateState(ConnectionState.RESPONDED);
    return createOutboundMessage(connection, signedConnectionResponse);
  }

  async acceptResponse(inboundMessage: InboundMessage) {
    const { wallet } = this.context;
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!message['connection~sig']) {
      throw new Error('Invalid message');
    }

    const originalMessage = await wallet.verify(message, 'connection');
    connection.updateDidExchangeConnection(originalMessage.connection);
    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    // dotnet doesn't send senderVk here
    // validateSenderKey(connection, sender_verkey);

    const response = createTrustPingMessage();
    connection.updateState(ConnectionState.COMPLETE);
    return createOutboundMessage(connection, response);
  }

  async acceptAck(inboundMessage: InboundMessage) {
    const { recipient_verkey, sender_verkey } = inboundMessage;
    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    validateSenderKey(connection, sender_verkey);

    if (connection.getState() !== ConnectionState.COMPLETE) {
      connection.updateState(ConnectionState.COMPLETE);
    }

    return null;
  }

  async createConnection(): Promise<Connection> {
    const [did, verkey] = await this.context.wallet.createDid({ method_name: 'sov' });
    const publicKey = new PublicKey(`${did}#1`, PublicKeyType.ED25519_SIG_2018, did, verkey);
    const service = new Service(`${did};indy`, this.getEndpoint(), [verkey], this.getRoutingKeys(), 0, 'IndyAgent');
    const auth = new Authentication(publicKey);
    const did_doc = new DidDoc(did, [auth], [publicKey], [service]);

    const connection = new Connection({
      did,
      didDoc: did_doc,
      verkey,
      state: ConnectionState.INIT,
    });

    this.connections.push(connection);

    return connection;
  }

  getConnections() {
    return this.connections;
  }

  findByVerkey(verkey: Verkey) {
    return this.connections.find(connection => connection.verkey === verkey);
  }

  findByTheirKey(verkey: Verkey) {
    return this.connections.find(connection => connection.theirKey === verkey);
  }

  private createInvitationDetails(config: InitConfig, connection: Connection) {
    const { didDoc } = connection;
    return {
      label: config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    };
  }

  private getEndpoint() {
    const connection = this.context.inboundConnection && this.context.inboundConnection.connection;
    const endpoint = connection && connection.theirDidDoc && connection.theirDidDoc.service[0].serviceEndpoint;
    return endpoint ? `${endpoint}` : `${this.context.config.url}:${this.context.config.port}/msg`;
  }

  private getRoutingKeys() {
    const verkey = this.context.inboundConnection && this.context.inboundConnection.verkey;
    return verkey ? [verkey] : [];
  }
}

function validateSenderKey(connection: Connection, senderKey: Verkey) {
  // TODO I have 2 questions

  // 1. I don't know whether following check is necessary. I guess it is, but we should validate this condition
  // for every other protocol. I also don't validate it `acceptRequest` because there is no `senderVk` in invitation
  // (which could be also a bug and against protocol starndard)

  // 2. I don't know whether to use `connection.theirKey` or `sender_verkey` for outbound message.

  if (connection.theirKey !== senderKey) {
    throw new Error(
      `Inbound message 'sender_key' ${senderKey} is different from connection.theirKey ${connection.theirKey}`
    );
  }
}

export { ConnectionService };
