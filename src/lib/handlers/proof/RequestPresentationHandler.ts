import { Handler, HandlerInboundMessage } from '../Handler';
import { ProofService } from '../../protocols/proof/ProofService';
import { RequestPresentationMessage } from '../../protocols/proof/messages/RequestPresentation';
import { JsonEncoder } from '../../utils/JsonEncoder';

/**
 * The funtionalities of this class is used to handle proof request
 */
export class RequestPresentationHandler implements Handler {
  private proofService: ProofService;
  public supportedMessages = [RequestPresentationMessage];

  public constructor(proofService: ProofService) {
    this.proofService = proofService;
  }

  /**
   * This Method is used to hansle proof request
   * @param messageContext T
   */
  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const [responseAttachment] = messageContext.message.attachments;
    const proof = JsonEncoder.fromBase64(responseAttachment.data.base64);
    //TODO : Process Proof request
  }
}
