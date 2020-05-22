import uuid from 'uuid';
import { Message, InboundMessage } from '../../types';
import { createInvitationMessage, createConnectionRequestMessage, createConnectionResponseMessage } from './messages';
import { AgentConfig } from '../../agent/AgentConfig';
import { createOutboundMessage } from '../helpers';
import { Connection } from './domain/Connection';
import { ConnectionState } from './domain/ConnectionState';
import { DidDoc, Service, PublicKey, PublicKeyType, Authentication } from './domain/DidDoc';
import { createTrustPingMessage } from '../trustping/messages';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';

class ConnectionService {
  wallet: Wallet;
  config: AgentConfig;
  connections: Connection[] = [];
  connectionRepository: Repository<ConnectionRecord>;

  constructor(wallet: Wallet, config: AgentConfig, connectionRepository: Repository<ConnectionRecord>) {
    this.wallet = wallet;
    this.config = config;
    this.connectionRepository = connectionRepository;
  }

  async createConnectionWithInvitation(): Promise<Connection> {
    const connection = await this.createConnection();
    const invitationDetails = this.createInvitationDetails(this.config, connection);
    const invitation = await createInvitationMessage(invitationDetails);
    connection.invitation = invitation;
    connection.updateState(ConnectionState.INVITED);
    this.connectionRepository.update(convertConnectionToRecord(connection));
    return connection;
  }

  async acceptInvitation(invitation: Message) {
    const connection = await this.createConnection();
    const connectionRequest = createConnectionRequestMessage(connection, this.config.label);
    connection.updateState(ConnectionState.REQUESTED);
    this.connectionRepository.update(convertConnectionToRecord(connection));
    return createOutboundMessage(connection, connectionRequest, invitation);
  }

  async acceptRequest(inboundMessage: InboundMessage) {
    const { message, recipient_verkey } = inboundMessage;
    const connection = await this.findByVerkey(recipient_verkey);

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
    const signedConnectionResponse = await this.wallet.sign(connectionResponse, 'connection', connection.verkey);
    connection.updateState(ConnectionState.RESPONDED);
    this.connectionRepository.update(convertConnectionToRecord(connection));
    return createOutboundMessage(connection, signedConnectionResponse);
  }

  async acceptResponse(inboundMessage: InboundMessage) {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = await this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!message['connection~sig']) {
      throw new Error('Invalid message');
    }

    const originalMessage = await this.wallet.verify(message, 'connection');
    connection.updateDidExchangeConnection(originalMessage.connection);
    this.connectionRepository.update(convertConnectionToRecord(connection));
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
    const connection = await this.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    validateSenderKey(connection, sender_verkey);

    if (connection.getState() !== ConnectionState.COMPLETE) {
      connection.updateState(ConnectionState.COMPLETE);
      this.connectionRepository.update(convertConnectionToRecord(connection));
    }

    return null;
  }

  async createConnection(): Promise<Connection> {
    const id = uuid();
    const [did, verkey] = await this.wallet.createDid({ method_name: 'sov' });
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
    const did_doc = new DidDoc(did, [auth], [publicKey], [service]);

    const connection = new Connection({
      id,
      did,
      didDoc: did_doc,
      verkey,
      state: ConnectionState.INIT,
    });

    this.connections.push(connection);
    this.connectionRepository.save(convertConnectionToRecord(connection));

    return connection;
  }

  async getConnections() {
    if (this.connections.length < 1) {
      await this.loadConnections();
    }
    return this.connections;
  }

  async findByVerkey(verkey: Verkey) {
    if (this.connections.length < 1) {
      await this.loadConnections();
    }
    return this.connections.find(connection => connection.verkey === verkey);
  }

  findByTheirKey(verkey: Verkey) {
    return this.connections.find(connection => connection.theirKey === verkey);
  }

  private createInvitationDetails(config: AgentConfig, connection: Connection) {
    const { didDoc } = connection;
    return {
      label: config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    };
  }

  private async loadConnections() {
    const connectionRecords = await this.connectionRepository.findAll();
    return connectionRecords.forEach(connectionRecord => {
      this.connections.push(convertRecordToConnection(connectionRecord));
    });
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

function convertConnectionToRecord(connection: Connection) {
  const { id, did, didDoc, verkey, theirDid, theirDidDoc, invitation } = connection;
  return new ConnectionRecord({
    id,
    did,
    didDoc,
    verkey,
    theirDid,
    theirDidDoc,
    invitation,
    state: connection.getState(),
    tags: { verkey },
  });
}

function convertRecordToConnection(connectionRecord: ConnectionRecord) {
  const { id, did, didDoc, verkey, theirDid, theirDidDoc, invitation, state } = connectionRecord;
  return new Connection({
    id,
    did,
    didDoc,
    verkey,
    theirDid,
    theirDidDoc,
    invitation,
    state,
  });
}

export { ConnectionService };
