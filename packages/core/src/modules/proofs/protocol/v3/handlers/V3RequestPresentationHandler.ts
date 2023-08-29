import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V3ProofProtocol } from '../V3ProofProtocol'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { V3RequestPresentationMessage } from '../messages/V3RequestPresentationMessage'

export class V3RequestPresentationHandler implements MessageHandler {
  private proofProtocol: V3ProofProtocol
  public supportedMessages = [V3RequestPresentationMessage]

  public constructor(proofProtocol: V3ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3RequestPresentationHandler>) {
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
    proofRecord: ProofExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V3RequestPresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending presentation with autoAccept`)

    const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
      proofRecord,
    })

    return getOutboundMessageContext(messageContext.agentContext, {
      message,
      lastReceivedMessage: messageContext.message,
      associatedRecord: proofRecord,
      connectionRecord: messageContext.connection,
    })
  }
}
