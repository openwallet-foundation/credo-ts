import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialProtocol } from '../V2CredentialProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../../storage'
import { RoutingService } from '../../../../routing/services/RoutingService'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

export class V2OfferCredentialHandler implements Handler {
  private credentialProtocol: V2CredentialProtocol

  public supportedMessages = [V2OfferCredentialMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundMessageContext<V2OfferCredentialMessage>) {
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
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>,
    offerMessage?: V2OfferCredentialMessage
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending request with autoAccept`)

    if (messageContext.connection) {
      const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, {
        credentialRecord,
      })
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: credentialRecord,
      })
    } else if (offerMessage?.service) {
      const routingService = messageContext.agentContext.dependencyManager.resolve(RoutingService)
      const routing = await routingService.getRouting(messageContext.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = offerMessage.service

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
