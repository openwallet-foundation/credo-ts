import uuid from 'uuid';
import { EventEmitter } from 'events';
import { Message, InboundMessage } from '../../types';
import { createInvitationMessage, createConnectionRequestMessage, createConnectionResponseMessage } from './messages';
import { AgentConfig } from '../../agent/AgentConfig';
import { createOutboundMessage } from '../helpers';
import { ConnectionState } from './domain/ConnectionState';
import { DidDoc, Service, PublicKey, PublicKeyType, Authentication } from './domain/DidDoc';
import { createTrustPingMessage } from '../trustping/messages';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { Repository } from '../../storage/Repository';
import { Wallet } from '../../wallet/Wallet';

enum EventType {
  StateChanged = 'stateChanged',
}

class ConnectionService extends EventEmitter {
  wallet: Wallet;
  config: AgentConfig;
  connectionRepository: Repository<ConnectionRecord>;

  constructor(wallet: Wallet, config: AgentConfig, connectionRepository: Repository<ConnectionRecord>) {
    super();
    this.wallet = wallet;
    this.config = config;
    this.connectionRepository = connectionRepository;
  }

  async createConnectionWithInvitation(): Promise<ConnectionRecord> {
    const connectionRecord = await this.createConnection();
    const invitationDetails = this.createInvitationDetails(this.config, connectionRecord);
    const invitation = await createInvitationMessage(invitationDetails);
    connectionRecord.invitation = invitation;
    await this.updateState(connectionRecord, ConnectionState.INVITED);
    return connectionRecord;
  }

  async acceptInvitation(invitation: Message) {
    const connectionRecord = await this.createConnection();
    const connectionRequest = createConnectionRequestMessage(connectionRecord, this.config.label);
    await this.updateState(connectionRecord, ConnectionState.REQUESTED);
    return createOutboundMessage(connectionRecord, connectionRequest, invitation);
  }

  async acceptRequest(inboundMessage: InboundMessage) {
    const { message, recipient_verkey } = inboundMessage;
    const connectionRecord = await this.findByVerkey(recipient_verkey);

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!message.connection) {
      throw new Error('Invalid message');
    }

    const requestConnection = message.connection;
    connectionRecord.updateDidExchangeConnection(requestConnection);

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with verkey ${connectionRecord.verkey} has no recipient keys.`);
    }

    connectionRecord.tags = { ...connectionRecord.tags, theirKey: connectionRecord.theirKey };

    const connectionResponse = createConnectionResponseMessage(connectionRecord, message['@id']);
    const signedConnectionResponse = await this.wallet.sign(connectionResponse, 'connection', connectionRecord.verkey);
    await this.updateState(connectionRecord, ConnectionState.RESPONDED);
    return createOutboundMessage(connectionRecord, signedConnectionResponse);
  }

  async acceptResponse(inboundMessage: InboundMessage) {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connectionRecord = await this.findByVerkey(recipient_verkey);

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!message['connection~sig']) {
      throw new Error('Invalid message');
    }

    const originalMessage = await this.wallet.verify(message, 'connection');
    connectionRecord.updateDidExchangeConnection(originalMessage.connection);

    if (!connectionRecord.theirKey) {
      throw new Error(`Connection with verkey ${connectionRecord.verkey} has no recipient keys.`);
    }

    connectionRecord.tags = { ...connectionRecord.tags, theirKey: connectionRecord.theirKey };

    // dotnet doesn't send senderVk here
    // validateSenderKey(connection, sender_verkey);

    const response = createTrustPingMessage();
    await this.updateState(connectionRecord, ConnectionState.COMPLETE);
    return createOutboundMessage(connectionRecord, response);
  }

  async acceptAck(inboundMessage: InboundMessage) {
    const { recipient_verkey, sender_verkey } = inboundMessage;
    const connectionRecord = await this.findByVerkey(recipient_verkey);

    if (!connectionRecord) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    validateSenderKey(connectionRecord, sender_verkey);

    if (connectionRecord.state !== ConnectionState.COMPLETE) {
      await this.updateState(connectionRecord, ConnectionState.COMPLETE);
    }

    return null;
  }

  async updateState(connectionRecord: ConnectionRecord, newState: ConnectionState) {
    connectionRecord.state = newState;
    await this.connectionRepository.update(connectionRecord);
    const { verkey, state } = connectionRecord;
    this.emit(EventType.StateChanged, { verkey, newState: state });
  }

  private async createConnection(): Promise<ConnectionRecord> {
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
    const didDoc = new DidDoc(did, [auth], [publicKey], [service]);

    const connectionRecord = new ConnectionRecord({
      id,
      did,
      didDoc,
      verkey,
      state: ConnectionState.INIT,
      tags: { verkey },
    });

    await this.connectionRepository.save(connectionRecord);
    return connectionRecord;
  }

  async getConnections() {
    return this.connectionRepository.findAll();
  }

  async findByVerkey(verkey: Verkey) {
    const connectionRecords = await this.connectionRepository.findByQuery({ verkey });
    return connectionRecords[0];
  }

  async findByTheirKey(verkey: Verkey) {
    const connectionRecords = await this.connectionRepository.findByQuery({ theirKey: verkey });

    if (connectionRecords.length > 1) {
      throw new Error(`There is more than one connection for given verkey ${verkey}`);
    }

    if (connectionRecords.length < 1) {
      return null;
    }

    return connectionRecords[0];
  }

  private createInvitationDetails(config: AgentConfig, connection: ConnectionRecord) {
    const { didDoc } = connection;
    return {
      label: config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    };
  }
}

function validateSenderKey(connection: ConnectionRecord, senderKey: Verkey) {
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

export { ConnectionService, EventType };
