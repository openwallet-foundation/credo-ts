import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { V1CredentialProtocol } from '../V1CredentialProtocol'

import { V1CredentialAckMessage } from '../messages'

export class V1CredentialAckHandler implements DidCommMessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1CredentialAckMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1CredentialAckHandler>) {
    await this.credentialProtocol.processAck(messageContext)

    return undefined
  }
}
