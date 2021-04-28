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
    await this.mediationRecipientService.processKeylistUpdateResults(messageContext)
  }
}
