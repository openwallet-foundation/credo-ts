import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { RoutingService } from '../../../../routing/services/RoutingService'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { V1OfferCredentialMessage } from '../messages'

export class V1OfferCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private routingService: RoutingService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1OfferCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    routingService: RoutingService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.routingService = routingService
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToOffer({
      credentialRecord,
      offerMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptOffer(credentialRecord, messageContext)
    }
  }

  private async acceptOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1OfferCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    if (messageContext.connection) {
      const { message } = await this.credentialService.acceptOffer({ credentialRecord })

      return createOutboundMessage(messageContext.connection, message)
    } else if (messageContext.message.service) {
      const routing = await this.routingService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.recipientKey.publicKeyBase58],
        routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
      })
      const recipientService = messageContext.message.service

      const { message } = await this.credentialService.acceptOffer({
        credentialRecord,
        credentialFormats: {
          indy: {
            holderDid: ourService.recipientKeys[0],
          },
        },
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
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

    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}
