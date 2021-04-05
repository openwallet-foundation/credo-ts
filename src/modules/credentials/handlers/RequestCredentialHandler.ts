import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { CredentialService } from '../services'
import { RequestCredentialMessage } from '../messages'

export class RequestCredentialHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [RequestCredentialMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    await this.credentialService.processRequest(messageContext)
  }
}
