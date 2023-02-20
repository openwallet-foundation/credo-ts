import type { V1CredentialProtocol } from '../V1CredentialProtocol'
import type { MessageHandler, MessageHandlerInboundMessage, CredentialExchangeRecord } from '@aries-framework/core'

import {
  OutboundMessageContext,
  RoutingService,
  DidCommMessageRepository,
  DidCommMessageRole,
  ServiceDecorator,
} from '@aries-framework/core'

import { V1OfferCredentialMessage } from '../messages'

export class V1OfferCredentialHandler implements MessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1OfferCredentialMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1OfferCredentialHandler>) {
    const credentialRecord = await this.credentialProtocol.processOffer(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToOffer(messageContext.agentContext, {
      credentialRecord,
      offerMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptOffer(credentialRecord, messageContext)
    }
  }

  private async acceptOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V1OfferCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending request with autoAccept`)
    if (messageContext.connection) {
      const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, { credentialRecord })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: credentialRecord,
      })
    } else if (messageContext.message.service) {
      const routingService = messageContext.agentContext.dependencyManager.resolve(RoutingService)
      const routing = await routingService.getRouting(messageContext.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = messageContext.message.service

      const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, {
        credentialRecord,
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService

      const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)
      await didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        serviceParams: {
          service: recipientService.resolvedDidCommService,
          senderKey: ourService.resolvedDidCommService.recipientKeys[0],
        },
      })
    }

    messageContext.agentContext.config.logger.error(`Could not automatically create credential request`)
  }
}
