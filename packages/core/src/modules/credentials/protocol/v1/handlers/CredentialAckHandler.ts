import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1CredentialService } from '../V1CredentialService'

import { CredentialAckMessage } from '../messages'

export class CredentialAckHandler implements Handler {
  private credentialService: V1CredentialService
  public supportedMessages = [CredentialAckMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
