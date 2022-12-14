import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V2CredentialProtocol } from '../V2CredentialProtocol'

import { V2CredentialAckMessage } from '../messages/V2CredentialAckMessage'

export class V2CredentialAckHandler implements Handler {
  private credentialProtocol: V2CredentialProtocol
  public supportedMessages = [V2CredentialAckMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: HandlerInboundMessage<V2CredentialAckHandler>) {
    await this.credentialProtocol.processAck(messageContext)
  }
}
