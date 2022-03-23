import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1CredentialService } from '../V1CredentialService'

import { V1CredentialAckMessage } from '../messages'

export class V1CredentialAckHandler implements Handler {
  private credentialService: V1CredentialService
  public supportedMessages = [V1CredentialAckMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<V1CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
