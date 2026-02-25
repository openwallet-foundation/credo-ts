import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'
import type { DidCommProofV1Protocol } from '../DidCommProofV1Protocol'

import { DidCommRequestPresentationV1Message } from '../messages'

export class DidCommRequestPresentationV1Handler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV1Protocol
  public supportedMessages = [DidCommRequestPresentationV1Message]

  public constructor(proofProtocol: DidCommProofV1Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestPresentationV1Handler>) {
    const proofRecord = await this.proofProtocol.processRequest(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToRequest(messageContext.agentContext, {
      proofRecord,
      requestMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptRequest(proofRecord, messageContext)
    }
  }

  private async acceptRequest(
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestPresentationV1Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending presentation with autoAccept on')

    const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
      proofRecord,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      message,
      lastReceivedMessage: messageContext.message,
      associatedRecord: proofRecord,
      connectionRecord: messageContext.connection,
    })
  }
}
