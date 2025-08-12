import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage, ProofExchangeRecord } from '@credo-ts/didcomm'
import type { V1ProofProtocol } from '../V1ProofProtocol'

import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { V1RequestPresentationMessage } from '../messages'

export class V1RequestPresentationHandler implements DidCommMessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1RequestPresentationMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1RequestPresentationHandler>) {
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
    proofRecord: ProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<V1RequestPresentationHandler>
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
