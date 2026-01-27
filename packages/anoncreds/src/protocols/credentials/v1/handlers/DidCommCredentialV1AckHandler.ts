import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { DidCommCredentialV1AckMessage } from '../messages'

export class DidCommCredentialV1AckHandler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol
  public supportedMessages = [DidCommCredentialV1AckMessage]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommCredentialV1AckHandler>) {
    await this.credentialProtocol.processAck(messageContext)

    return undefined
  }
}
