import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../../logger'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { RoutingService } from '../../../../routing/services/RoutingService'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

export class V2OfferCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private routingService: RoutingService
  private logger: Logger

  public supportedMessages = [V2OfferCredentialMessage]
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(
    credentialService: V2CredentialService,
    routingService: RoutingService,
    didCommMessageRepository: DidCommMessageRepository,
    logger: Logger
  ) {
    this.credentialService = credentialService
    this.routingService = routingService
    this.didCommMessageRepository = didCommMessageRepository
    this.logger = logger
  }

  public async handle(messageContext: InboundMessageContext<V2OfferCredentialMessage>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToOffer(messageContext.agentContext, {
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
    this.logger.info(`Automatically sending request with autoAccept`)

    if (messageContext.connection) {
      const { message } = await this.credentialService.acceptOffer(messageContext.agentContext, {
        credentialRecord,
      })
      return createOutboundMessage(messageContext.connection, message)
    } else if (offerMessage?.service) {
      const routing = await this.routingService.getRouting(messageContext.agentContext)
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = offerMessage.service

      const { message } = await this.credentialService.acceptOffer(messageContext.agentContext, {
        credentialRecord,
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService

      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.logger.error(`Could not automatically create credential request`)
  }
}
