import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { KeylistUpdateResponseMessage } from '../messages';
import { MediationRecipientService } from '../services';

export class KeylistUpdateResponseHandler implements Handler {
  public mediationRecipientService: MediationRecipientService;
  public supportedMessages = [KeylistUpdateResponseMessage];

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService;
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    // TODO It should handle the response when agent calls `await this.consumerRoutingService.createRoute(connectionRecord.verkey)` and notify about the result.
  }
}
