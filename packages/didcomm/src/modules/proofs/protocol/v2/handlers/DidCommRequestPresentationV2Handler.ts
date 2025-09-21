import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofExchangeRecord } from '../../../repository/DidCommProofExchangeRecord'
import type { V2DidCommProofProtocol } from '../DidCommProofV2Protocol'

import { getDidCommOutboundMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import { DidCommRequestPresentationV2Message } from '../messages/DidCommRequestPresentationV2Message'

export class DidCommRequestPresentationV2Handler implements DidCommMessageHandler {
  private proofProtocol: V2DidCommProofProtocol
  public supportedMessages = [DidCommRequestPresentationV2Message]

  public constructor(proofProtocol: V2DidCommProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestPresentationV2Handler>) {
    const proofRecord = await this.proofProtocol.processRequest(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToRequest(messageContext.agentContext, {
      proofRecord,
      requestMessage: messageContext.message,
    })

    messageContext.agentContext.config.logger.debug(`Should auto respond to request: ${shouldAutoRespond}`)

    if (shouldAutoRespond) {
      return await this.acceptRequest(proofRecord, messageContext)
    }
  }

  private async acceptRequest(
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestPresentationV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending presentation with autoAccept')

    const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
      proofRecord,
    })

    return getDidCommOutboundMessageContext(messageContext.agentContext, {
      message,
      lastReceivedMessage: messageContext.message,
      associatedRecord: proofRecord,
      connectionRecord: messageContext.connection,
    })
  }
}
