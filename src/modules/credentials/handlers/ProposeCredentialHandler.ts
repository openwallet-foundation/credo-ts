import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { CredentialService } from '../services'
import { ProposeCredentialMessage } from '../messages'

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
