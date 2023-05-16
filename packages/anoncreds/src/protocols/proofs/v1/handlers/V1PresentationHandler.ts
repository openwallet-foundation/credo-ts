import type { V1ProofProtocol } from '../V1ProofProtocol'
import type { MessageHandler, MessageHandlerInboundMessage, ProofExchangeRecord } from '@aries-framework/core'

import { OutboundMessageContext, DidCommMessageRepository } from '@aries-framework/core'

import { V1PresentationMessage, V1RequestPresentationMessage } from '../messages'

export class V1PresentationHandler implements MessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1PresentationMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1PresentationHandler>) {
    const proofRecord = await this.proofProtocol.processPresentation(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToPresentation(messageContext.agentContext, {
      presentationMessage: messageContext.message,
      proofRecord,
    })

    if (shouldAutoRespond) {
      return await this.acceptPresentation(proofRecord, messageContext)
    }
  }

  private async acceptPresentation(
    proofRecord: ProofExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V1PresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending acknowledgement with autoAccept`)

    if (messageContext.connection) {
      const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
        proofRecord,
      })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: proofRecord,
      })
    } else if (messageContext.message.service) {
      const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
        proofRecord,
      })

      const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
      const requestMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: proofRecord.id,
        messageClass: V1RequestPresentationMessage,
      })

      const recipientService = messageContext.message.service
      const ourService = requestMessage?.service

      if (!ourService) {
        messageContext.agentContext.config.logger.error(
          `Could not automatically create presentation ack. Missing ourService on request message`
        )
        return
      }

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
