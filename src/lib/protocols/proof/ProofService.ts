import { EventEmitter } from 'events';
import { RequestPresentationMessage } from './messages/RequestPresentationMessage';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment';
import { JsonEncoder } from '../../utils/JsonEncoder';
import { Repository } from '../../storage/Repository';
import { ProofRecord } from '../../storage/ProofRecord';
import { ProofState } from './ProofState';
import { ProofRequestMessage } from './messages/ProofRequestMessage';

import { InboundMessageContext } from '../../agent/models/InboundMessageContext';

export enum EventType {
  StateChanged = 'stateChanged',
}

export class ProofService extends EventEmitter {
  private proofRepository: Repository<ProofRecord>;

  public constructor(proofRepository: Repository<ProofRecord>) {
    super();
    this.proofRepository = proofRepository;
  }

  /**
   * Create a new Proof Request
   *
   * @param connection Connection to which agent wants to send proof request
   * @param ProofRequestTemplate Template for Proof Request
   * @returns Proof Request message
   */
  public async createProofRequest(
    connection: ConnectionRecord,
    proofRequestTemplate: ProofRequestTemplate
  ): Promise<RequestPresentationMessage> {
    const { comment, proofRequest } = proofRequestTemplate;
    const attachment = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    });

    const requestPresentationMessage = new RequestPresentationMessage({
      comment,
      attachments: [attachment],
    });

    //save in repository
    const proofRecord = new ProofRecord({
      connectionId: connection.id,
      presentationRequest: requestPresentationMessage,
      state: ProofState.RequestSent,
      tags: { threadId: requestPresentationMessage.id },
    });

    await this.proofRepository.save(proofRecord);
    this.emit(EventType.StateChanged, { proofRecord, prevState: ProofState.RequestSent });

    return requestPresentationMessage;
  }

  /**
   * Process incoming Proof request.
   *
   * @param messageContext
   */
  public async processRequestPresentation(
    messageContext: InboundMessageContext<RequestPresentationMessage>
  ): Promise<ProofRecord> {
    const proofRequest = messageContext.message;
    const connection = messageContext.connection;

    if (!connection) {
      throw new Error('There is no connection in message context.');
    }

    const [responseAttachment] = messageContext.message.attachments;

    if (!responseAttachment.data.base64) {
      throw new Error('Missing required base64 encoded attachment data');
    }

    const proofRecord = new ProofRecord({
      connectionId: connection.id,
      presentationRequest: proofRequest,
      state: ProofState.RequestReceived,
      tags: { threadId: proofRequest.id },
    });
    //save in repository
    await this.proofRepository.save(proofRecord);
    this.emit(EventType.StateChanged, { proofRecord, prevState: ProofState.RequestReceived });

    //TODO : process for genrating proof
    return proofRecord;
  }

  public async updateState(proofRecord: ProofRecord, newState: ProofState) {
    const prevState = proofRecord.state;
    proofRecord.state = newState;
    await this.proofRepository.update(proofRecord);

    this.emit(EventType.StateChanged, { proofRecord, prevState });
  }

  public async getAll(): Promise<ProofRecord[]> {
    return this.proofRepository.findAll();
  }

  public async find(id: string): Promise<ProofRecord> {
    return this.proofRepository.find(id);
  }
}

/*
 * This interface used as Proof Request Template
 */
export interface ProofRequestTemplate {
  comment?: string;
  proofRequest: ProofRequestMessage;
}
