import { EventEmitter } from 'events';
import { Verkey } from 'indy-sdk';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext';
import { Repository } from '../../../storage/Repository';
import { ConnectionRecord } from '../../connections';
import { MediationDenyMessage, MediationGrantMessage } from '../messages';
import { MediationRequestMessage } from '../messages/MediationRequestMessage';
import { MediationRole } from '../models/MediationRole';
import { MediationState } from '../models/MediationState';

import { MediationRecord, MediationRecordProps } from '../repository/MediationRecord';

export enum MediationEventType {
  StateChanged = 'stateChanged',
}

export interface MediationStateChangedEvent {
  mediationRecord: MediationRecord;
  previousState: MediationState;
}

export interface MediationGrantedEvent {
  connectionRecord: ConnectionRecord;
  endpoint: string;
  routingKeys: Verkey[];
}

export class MediationService extends EventEmitter {
  private mediationRepository: Repository<MediationRecord>;
  private agentConfig: AgentConfig;
  private routingKey?: Verkey;

  public constructor(mediationRepository: Repository<MediationRecord>, agentConfig: AgentConfig) {
    super();
    this.mediationRepository = mediationRepository;
    this.agentConfig = agentConfig;
  }

  public setRoutingKey(verkey: Verkey) {
    this.routingKey = verkey;
  }

  public async requestMediation(connection: ConnectionRecord) {
    const mediation = await this.create({
      connectionId: connection.id,
      mediatorTerms: [],
      recipientTerms: [],
      role: MediationRole.Recipient,
      state: MediationState.Requested,
    });

    const mediationRequestMessage = new MediationRequestMessage({
      mediator_terms: mediation.mediatorTerms,
      recipient_terms: mediation.recipientTerms,
    });

    return createOutboundMessage(connection, mediationRequestMessage);
  }

  public async grantMediation(connection: ConnectionRecord, mediation: MediationRecord) {
    mediation.routingKeys = this.routingKey ? [this.routingKey] : [];

    const grantMediationMessage = new MediationGrantMessage({
      endpoint: this.agentConfig.getEndpoint(),
      routing_keys: mediation.routingKeys,
    });

    return createOutboundMessage(connection, grantMediationMessage);
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    const connection = messageContext.connection;

    // Assert connection
    connection?.assertReady();
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message');
    }

    const mediationRecord = await this.create({
      connectionId: connection.id,
      mediatorTerms: messageContext.message.mediator_terms,
      recipientTerms: messageContext.message.recipient_terms,
      role: MediationRole.Mediator,
      state: MediationState.Init,
    });

    // Mediation can be either granted or denied. Let business logic decide that
    await this.updateState(mediationRecord, MediationState.Requested);
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = messageContext.connection;

    // Assert connection
    connection?.assertReady();
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message');
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '');

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`);
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested);
    mediationRecord.assertConnection(connection.id);

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint;
    mediationRecord.routingKeys = messageContext.message.routing_keys;
    await this.updateState(mediationRecord, MediationState.Granted);

    return mediationRecord;
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.connection;

    // Assert connection
    connection?.assertReady();
    if (!connection) {
      throw new Error('No connection associated with incoming mediation deny message');
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '');

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`);
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested);
    mediationRecord.assertConnection(connection.id);

    // Update record
    mediationRecord.mediatorTerms = messageContext.message.mediator_terms;
    mediationRecord.recipientTerms = messageContext.message.recipient_terms;
    await this.updateState(mediationRecord, MediationState.Denied);

    return mediationRecord;
  }

  public async create(options: MediationRecordProps): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord(options);
    await this.mediationRepository.save(mediationRecord);
    return mediationRecord;
  }

  public async findById(id: string): Promise<MediationRecord | null> {
    return await this.mediationRepository.find(id);
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    /*const mediationRecords = await this.mediationRepository.findByQuery({ connectionId: id });

    if (mediationRecords.length > 1) {
      throw new Error(`There is more than one mediation for given connection Id ${id}`);
    }

    if (mediationRecords.length < 1) {
      return null;
    }

    return mediationRecords[0];*/
    const mediationRecords = await this.mediationRepository.findAll();

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record;
      }
    }
    return null;
  }

  public async findAll(): Promise<MediationRecord[] | null> {
    return await this.mediationRepository.findAll();
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state;

    mediationRecord.state = newState;

    await this.mediationRepository.update(mediationRecord);

    const event: MediationStateChangedEvent = {
      mediationRecord,
      previousState: previousState,
    };

    this.emit(MediationEventType.StateChanged, event);
  }
}
