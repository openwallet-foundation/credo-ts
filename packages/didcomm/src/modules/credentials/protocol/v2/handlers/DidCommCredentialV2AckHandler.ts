import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'

import { DidCommCredentialV2AckMessage } from '../messages/DidCommCredentialV2AckMessage'

export class DidCommCredentialV2AckHandler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol
  public supportedMessages = [DidCommCredentialV2AckMessage]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommCredentialV2AckHandler>) {
    await this.credentialProtocol.processAck(messageContext)

    return undefined
  }
}
