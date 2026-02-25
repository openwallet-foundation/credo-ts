import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofProtocol } from '../../DidCommProofProtocol'

import { DidCommPresentationV2AckMessage } from '../messages'

export class DidCommPresentationV2AckHandler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofProtocol
  public supportedMessages = [DidCommPresentationV2AckMessage]

  public constructor(proofProtocol: DidCommProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV2AckHandler>) {
    await this.proofProtocol.processAck(messageContext)

    return undefined
  }
}
