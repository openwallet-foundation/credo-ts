import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V3CredentialProtocol } from '../V3CredentialProtocol'

import { V3CredentialAckMessage } from '../messages/V3CredentialAckMessage'

export class V3CredentialAckHandler implements MessageHandler {
  private credentialProtocol: V3CredentialProtocol
  public supportedMessages = [V3CredentialAckMessage]

  public constructor(credentialProtocol: V3CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3CredentialAckHandler>) {
    await this.credentialProtocol.processAck(messageContext)
  }
}
