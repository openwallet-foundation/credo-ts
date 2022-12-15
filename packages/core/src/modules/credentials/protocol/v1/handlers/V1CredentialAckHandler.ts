import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V1CredentialService } from '../V1CredentialService'

import { V1CredentialAckMessage } from '../messages'

export class V1CredentialAckHandler implements MessageHandler {
  private credentialService: V1CredentialService
  public supportedMessages = [V1CredentialAckMessage]

  public constructor(credentialService: V1CredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
