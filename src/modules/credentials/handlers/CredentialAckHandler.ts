import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { CredentialAckMessage } from '../messages'

export class CredentialAckHandler implements Handler {
  private credentialService: CredentialService
  public supportedMessages = [CredentialAckMessage]

  public constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
