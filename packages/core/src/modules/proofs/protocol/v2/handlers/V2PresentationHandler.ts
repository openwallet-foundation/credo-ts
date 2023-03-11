import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofExchangeRecord } from '../../../repository'
import type { V2ProofProtocol } from '../V2ProofProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { DidCommMessageRepository } from '../../../../../storage'
import { V2PresentationMessage, V2RequestPresentationMessage } from '../messages'

export class V2PresentationHandler implements MessageHandler {
  private proofProtocol: V2ProofProtocol
  public supportedMessages = [V2PresentationMessage]

  public constructor(proofProtocol: V2ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2PresentationHandler>) {
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
    messageContext: MessageHandlerInboundMessage<V2PresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending acknowledgement with autoAccept`)

    const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
      proofRecord,
    })

    const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
    const requestMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    if (messageContext.connection) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: proofRecord,
      })
    } else if (requestMessage?.service && messageContext.message?.service) {
      const recipientService = messageContext.message?.service
      const ourService = requestMessage?.service

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        serviceParams: {
          service: recipientService.resolvedDidCommService,
          senderKey: ourService.resolvedDidCommService.recipientKeys[0],
          returnRoute: true,
        },
      })
    }

    messageContext.agentContext.config.logger.error(`Could not automatically create presentation ack`)
  }
}
