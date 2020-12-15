import { EventEmitter } from 'events';
import { RequestPresentationMessage } from './messages/RequestPresentation';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { Attachment } from '../../utils/Attachment';
import { JsonEncoder } from '../../utils/JsonEncoder';
import { Repository } from '../../storage/Repository';
import { ProofRecord } from '../../storage/ProofRecord';
import { ProofState } from './ProofState';
import { ProofRequest } from './messages/ProofRequest';

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
    
    const { comment,proofRequest } = proofRequestTemplate;
    const attachment = new Attachment({
      // id: "libindy-request-presentation-0",
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.toBase64(proofRequest),
      },
    });

    const requestPresentationMessage = new RequestPresentationMessage({
      comment,
      attachments: [attachment],
    });

    //save in repository
    const proofRequestPresentation = new ProofRecord({
      connectionId: connection.id,
      presentationRequest: requestPresentationMessage,
      state: ProofState.RequestSent,
      tags: { threadId: requestPresentationMessage.id },
    });

    await this.proofRepository.save(proofRequestPresentation);
    this.emit(EventType.StateChanged, { proofRequestPresentation, prevState: null });
    
    return requestPresentationMessage;
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
  proofRequest: ProofRequest;
}


