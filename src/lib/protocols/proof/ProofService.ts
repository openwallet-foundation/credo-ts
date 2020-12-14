import { EventEmitter } from 'events';
import { Wallet } from '../../wallet/Wallet';
import { RequestPresentationMessage } from './messages/RequestPresentation';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { Attachment } from '../../utils/Attachment';
import { JsonEncoder } from '../../utils/JsonEncoder';

export enum EventType {
  StateChanged = 'stateChanged',
}

export class ProofService extends EventEmitter {

  public constructor(wallet: Wallet) {
    super();
  }

  /**
   * Create a new Proof Request
   *
   * @param connection Connection to which agent wants to send proof request
   * @param ProofRequestTemplate Template for Proof Request
   * @returns Proof Request message
   */
  public async createProofRequest(connection: ConnectionRecord, proofRequestTemplate: ProofRequestTemplate,
  ): Promise<RequestPresentationMessage> {

    const { comment } = proofRequestTemplate;
    console.log("Insde Craete Proof Rquest");
    const attachment = new Attachment({
      // id: "libindy-request-presentation-0",
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.toBase64(proofRequestTemplate),
      },
    });

    const requestPresentationMessage = new RequestPresentationMessage({
      comment,
      attachments: [attachment],
    });
    return requestPresentationMessage;
  }
}

/*
* This interface used as Proof Request Template
*/
export interface ProofRequestTemplate {
  comment?: string;
  preview: RequestPresentationMessage;
}