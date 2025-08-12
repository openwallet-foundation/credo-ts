import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommCredentialProtocol } from '../V2DidCommCredentialProtocol'

import { V2CredentialAckMessage } from '../messages/V2CredentialAckMessage'

export class V2CredentialAckHandler implements DidCommMessageHandler {
  private credentialProtocol: V2DidCommCredentialProtocol
  public supportedMessages = [V2CredentialAckMessage]

  public constructor(credentialProtocol: V2DidCommCredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2CredentialAckHandler>) {
    await this.credentialProtocol.processAck(messageContext)

    return undefined
  }
}
