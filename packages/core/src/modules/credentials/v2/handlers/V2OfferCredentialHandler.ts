import type { InboundMessageContext } from '../../../../../src/agent/models/InboundMessageContext'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { MediationRecipientService } from '../../../routing/services/MediationRecipientService'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { CredentialRecord } from '../../repository/CredentialRecord'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../src/agent/helpers'
import { ServiceDecorator } from '../../../../../src/decorators/service/ServiceDecorator'
import { unitTestLogger } from '../../../../logger'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

export class V2OfferCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [V2OfferCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    mediationRecipientService: MediationRecipientService
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: InboundMessageContext<V2OfferCredentialMessage>) {
    unitTestLogger('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR OFFER CREDENTIAL')

    const credentialRecord = await this.credentialService.processOffer(messageContext)

    const offerMessage: V2OfferCredentialMessage = credentialRecord.offerMessage as V2OfferCredentialMessage

    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(offerMessage.formats)

    // 2. loop through found formats
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      const formatShouldAutoRespond = formatService.shouldAutoRespondToOffer(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials
      )

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }

    unitTestLogger('----------------->>> OFFER HANDLER shouldAutoRespond = ' + shouldAutoRespond)
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createRequest(credentialRecord, messageContext)
    }
  }

  private async createRequest(
    record: CredentialRecord,
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (messageContext.connection) {
      unitTestLogger('  AutoAccept is ON => createRequest')
      const { message } = await this.credentialService.createRequest(record, {
        holderDid: messageContext.connection.did,
      })

      return createOutboundMessage(messageContext.connection, message)
    } else if (record.offerMessage?.service) {
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
      const recipientService = record.offerMessage.service

      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        holderDid: ourService.recipientKeys[0],
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
      credentialRecord.requestMessage = message

      await this.credentialService.update(credentialRecord)

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}
