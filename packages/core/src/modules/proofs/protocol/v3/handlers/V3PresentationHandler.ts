import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofExchangeRecord } from '../../../repository'
import type { V3ProofProtocol } from '../V3ProofProtocol'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { DidCommMessageRepository } from '../../../../../storage'
import { V3PresentationMessage, V3RequestPresentationMessage } from '../messages'

export class V3PresentationHandler implements MessageHandler {
  private proofProtocol: V3ProofProtocol
  public supportedMessages = [V3PresentationMessage]

  public constructor(proofProtocol: V3ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3PresentationHandler>) {
    const proofRecord = await this.proofProtocol.processPresentation(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToPresentation(messageContext.agentContext, {
      proofRecord,
      presentationMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptPresentation(proofRecord, messageContext)
    }
  }

  private async acceptPresentation(
    proofRecord: ProofExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V3PresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending acknowledgement with autoAccept`)

    const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
      proofRecord,
    })

    const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const requestMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3RequestPresentationMessage,
    })

    return getOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: proofRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
    })
  }
}
