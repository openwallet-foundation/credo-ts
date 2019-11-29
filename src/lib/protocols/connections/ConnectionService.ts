import { Connection, ConnectionState, InitConfig, Message, InboundMessage } from '../../types';
import {
  createInvitationMessage,
  createConnectionRequestMessage,
  createConnectionResponseMessage,
  createAckMessage,
} from './messages';
import { Context } from '../../agent/Context';
import { createOutboundMessage } from '../helpers';

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
    connection.state = ConnectionState.INVITED;
    connection.invitation = invitation;
    return connection;
  }

  async acceptInvitation(invitation: Message) {
    const connection = await this.createConnection();
    const connectionRequest = createConnectionRequestMessage(connection, this.context.config.label);

    connection.state = ConnectionState.REQUESTED;

    return createOutboundMessage(connection, connectionRequest, invitation);
  }

  async acceptRequest(inboundMessage: InboundMessage) {
    // TODO Temporarily get context from service until this code will be move into connection service itself
    const { wallet } = this.context;
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    // TODO I have 2 questions
    // 1. I don't know whether following check is necessary.
    // 2. I don't know whether to use `connection.theirKey` or `sender_verkey` for outbound message.
    //
    // This problem in other handlers is handled just by checking existance of attribute `connection.theirKey`
    // and omitting `sender_key` from any usage.
    if (sender_verkey !== connection.theirKey) {
      throw new Error('Inbound message `sender_key` attribute is different from connection.theirKey');
    }

    if (!message.connection) {
      throw new Error('Invalid message');
    }

    const connectionRequest = message;

    connection.theirDid = connectionRequest.connection.did;
    connection.theirDidDoc = connectionRequest.connection.did_doc;
    // Keep also theirKey for debug reasons
    connection.theirKey = connection.theirDidDoc.service[0].recipientKeys[0];

    if (!connection.theirKey) {
      throw new Error('Missing verkey in connection request!');
    }

    const connectionResponse = createConnectionResponseMessage(connection, message['@id']);

    const signedConnectionResponse = await wallet.sign(connectionResponse, 'connection', connection.verkey);

    connection.state = ConnectionState.RESPONDED;

    return createOutboundMessage(connection, signedConnectionResponse);
  }

  async acceptResponse(inboundMessage: InboundMessage) {
    // TODO Temporarily get context from service until this code will be move into connection service itself
    const { wallet } = this.context;
    const { message, recipient_verkey, sender_verkey } = inboundMessage;

    if (!message['connection~sig']) {
      throw new Error('Invalid message');
    }

    const connectionSignature = message['connection~sig'];
    const signerVerkey = connectionSignature.signers;
    const data = Buffer.from(connectionSignature.sig_data, 'base64');
    const signature = Buffer.from(connectionSignature.signature, 'base64');

    // check signature
    const valid = await wallet.verify(signerVerkey, data, signature);

    if (!valid) {
      throw new Error('Signature is not valid!');
    }

    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const connectionReponse = JSON.parse(data.toString('utf-8'));
    connection.theirDid = connectionReponse.did;
    connection.theirDidDoc = connectionReponse.did_doc;
    // Keep also theirKey for debug reasons
    connection.theirKey = connection.theirDidDoc.service[0].recipientKeys[0];

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const response = createAckMessage(message['@id']);

    connection.state = ConnectionState.COMPLETE;

    return createOutboundMessage(connection, response);
  }

  async acceptAck(inboundMessage: InboundMessage) {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (connection.state !== ConnectionState.COMPLETE) {
      connection.state = ConnectionState.COMPLETE;
    }

    return null;
  }

  async createConnection(): Promise<Connection> {
    const [did, verkey] = await this.context.wallet.createDid();
    const did_doc = {
      '@context': 'https://w3id.org/did/v1',
      service: [
        {
          id: 'did:example:123456789abcdefghi#did-communication',
          type: 'did-communication',
          priority: 0,
          recipientKeys: [verkey],
          routingKeys: this.getRoutingKeys(),
          serviceEndpoint: this.getEndpoint(),
        },
      ],
    };

    const connection = {
      did,
      didDoc: did_doc,
      verkey,
      state: ConnectionState.INIT,
      messages: [],
    };

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

  // TODO Temporarily get context from service until this code will be move into connection service itself
  getContext() {
    return this.context;
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

export { ConnectionService };
