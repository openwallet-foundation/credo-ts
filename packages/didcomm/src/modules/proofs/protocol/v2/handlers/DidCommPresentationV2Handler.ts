import { getOutboundDidCommMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../../repository'
import type { DidCommProofExchangeRecord } from '../../../repository'
import type { DidCommProofV2Protocol } from '../DidCommProofV2Protocol'
import { DidCommPresentationV2Message, DidCommRequestPresentationV2Message } from '../messages'

export class DidCommPresentationV2Handler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV2Protocol
  public supportedMessages = [DidCommPresentationV2Message]

  public constructor(proofProtocol: DidCommProofV2Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV2Handler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending acknowledgement with autoAccept')

    const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
      proofRecord,
    })

    const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const requestMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
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
