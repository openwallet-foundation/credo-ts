import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { V1ProofProtocol } from '../V1ProofProtocol'

import { V1PresentationAckMessage } from '../messages'

export class V1PresentationAckHandler implements DidCommMessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1PresentationAckMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1PresentationAckHandler>) {
    await this.proofProtocol.processAck(messageContext)

    return undefined
  }
}
