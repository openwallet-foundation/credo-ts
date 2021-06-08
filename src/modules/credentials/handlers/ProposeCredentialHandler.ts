import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ProposeCredentialMessage } from '../messages'
import { CredentialService } from '../services'

export class ProposeCredentialHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [ProposeCredentialMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<ProposeCredentialHandler>) {
    await this.credentialService.processProposal(messageContext)
  }
}
