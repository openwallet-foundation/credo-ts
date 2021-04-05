import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { CredentialService } from '../services'
import { OfferCredentialMessage } from '../messages'

export class OfferCredentialHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [OfferCredentialMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    await this.credentialService.processOffer(messageContext)
  }
}
