import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V2CredentialService } from '../V2CredentialService'

import { V2CredentialAckMessage } from '../messages/V2CredentialAckMessage'

export class V2CredentialAckHandler implements Handler {
  private credentialService: V2CredentialService
  public supportedMessages = [V2CredentialAckMessage]

  public constructor(credentialService: V2CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<V2CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
