import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V2ProofProtocol } from '../V2ProofProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { DidCommMessageRepository } from '../../../../../storage/didcomm/DidCommMessageRepository'
import { RoutingService } from '../../../../routing'
import { V2RequestPresentationMessage } from '../messages/V2RequestPresentationMessage'

export class V2RequestPresentationHandler implements MessageHandler {
  private proofProtocol: V2ProofProtocol
  public supportedMessages = [V2RequestPresentationMessage]

  public constructor(proofProtocol: V2ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2RequestPresentationHandler>) {
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
    messageContext: MessageHandlerInboundMessage<V2RequestPresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending presentation with autoAccept`)

    const { message } = await this.proofProtocol.acceptRequest(messageContext.agentContext, {
      proofRecord,
    })

    if (messageContext.connection) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: proofRecord,
      })
    } else if (messageContext.message.service) {
      const routingService = messageContext.agentContext.dependencyManager.resolve<RoutingService>(RoutingService)
      const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)

      const routing = await routingService.getRouting(messageContext.agentContext)
      message.service = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = messageContext.message.service

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
