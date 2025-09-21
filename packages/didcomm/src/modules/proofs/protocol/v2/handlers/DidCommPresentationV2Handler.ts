import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofExchangeRecord } from '../../../repository'
import type { V2DidCommProofProtocol } from '../DidCommProofV2Protocol'

import { getDidCommOutboundMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../../repository'
import { DidCommPresentationV2Message, DidCommRequestPresentationV2Message } from '../messages'

export class DidCommPresentationV2Handler implements DidCommMessageHandler {
  private proofProtocol: V2DidCommProofProtocol
  public supportedMessages = [DidCommPresentationV2Message]

  public constructor(proofProtocol: V2DidCommProofProtocol) {
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

    return getDidCommOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: proofRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
    })
  }
}
