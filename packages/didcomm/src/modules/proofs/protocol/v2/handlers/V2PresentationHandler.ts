import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofExchangeRecord } from '../../../repository'
import type { V2DidCommProofProtocol } from '../V2DidCommProofProtocol'

import { getOutboundDidCommMessageContext } from '../../../../../getOutboundDidCommMessageContext'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../../repository'
import { V2PresentationMessage, V2RequestPresentationMessage } from '../messages'

export class V2PresentationHandler implements DidCommMessageHandler {
  private proofProtocol: V2DidCommProofProtocol
  public supportedMessages = [V2PresentationMessage]

  public constructor(proofProtocol: V2DidCommProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2PresentationHandler>) {
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
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<V2PresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending acknowledgement with autoAccept')

    const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
      proofRecord,
    })

    const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const requestMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
      role: DidCommMessageRole.Sender,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: proofRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
    })
  }
}
