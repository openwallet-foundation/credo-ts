import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DidCommProofV1Protocol } from '../DidCommProofV1Protocol'

import { DidCommPresentationV1AckMessage } from '../messages'

export class DidCommPresentationV1AckHandler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV1Protocol
  public supportedMessages = [DidCommPresentationV1AckMessage]

  public constructor(proofProtocol: DidCommProofV1Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV1AckHandler>) {
    await this.proofProtocol.processAck(messageContext)

    return undefined
  }
}
