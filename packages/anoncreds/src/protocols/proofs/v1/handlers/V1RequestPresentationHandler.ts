import type { V1ProofProtocol } from '../V1ProofProtocol'
import type { MessageHandler, MessageHandlerInboundMessage, ProofExchangeRecord } from '@aries-framework/core'

import {
  OutboundMessageContext,
  RoutingService,
  ServiceDecorator,
  DidCommMessageRepository,
  DidCommMessageRole,
} from '@aries-framework/core'

import { V1RequestPresentationMessage } from '../messages'

export class V1RequestPresentationHandler implements MessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1RequestPresentationMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1RequestPresentationHandler>) {
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
    messageContext: MessageHandlerInboundMessage<V1RequestPresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending presentation with autoAccept on`)

    if (messageContext.connection) {
      const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
        proofRecord,
      })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: proofRecord,
      })
    } else if (messageContext.message.service) {
      const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
        proofRecord,
      })

      const routingService = messageContext.agentContext.dependencyManager.resolve(RoutingService)
      const routing = await routingService.getRouting(messageContext.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = messageContext.message.service

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService

      const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
      await didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: message,
        associatedRecordId: proofRecord.id,
        role: DidCommMessageRole.Sender,
      })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        serviceParams: {
          service: recipientService.resolvedDidCommService,
          senderKey: message.service.resolvedDidCommService.recipientKeys[0],
          returnRoute: true,
        },
      })
    }

    messageContext.agentContext.config.logger.error(`Could not automatically create presentation`)
  }
}
