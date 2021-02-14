import { Handler, HandlerInboundMessage } from '../Handler';
import { createOutboundMessage } from '../../protocols/helpers';
import { CredentialService, IssueCredentialMessage } from '../../protocols/issue-credential';

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService;
  public supportedMessages = [IssueCredentialMessage];

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService;
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext);

    if (messageContext.message.requiresAck()) {
      if (!messageContext.connection) {
        throw new Error('There is no connection in message context.');
      }
      const { message } = await this.credentialService.createAck(credentialRecord);
      return createOutboundMessage(messageContext.connection, message);
    }
  }
}
