import { Handler, HandlerInboundMessage } from '../Handler';
import { ProofService } from '../../protocols/proof/ProofService';
import { RequestPresentationMessage } from '../../protocols/proof/messages/RequestPresentationMessage';
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
    await this.proofService.processRequestPresentation(messageContext);
  }
}
