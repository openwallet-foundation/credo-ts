import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'

import { getDidCommOutboundMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import { DidCommOfferCredentialV2Message } from '../messages/DidCommOfferCredentialV2Message'

export class DidCommOfferCredentialV2Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol

  public supportedMessages = [DidCommOfferCredentialV2Message]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommOfferCredentialV2Message>) {
    const credentialExchangeRecord = await this.credentialProtocol.processOffer(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToOffer(messageContext.agentContext, {
      credentialExchangeRecord,
      offerMessage: messageContext.message,
    })
    if (shouldAutoRespond) {
      return await this.acceptOffer(credentialExchangeRecord, messageContext)
    }
  }

  private async acceptOffer(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommOfferCredentialV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    return getDidCommOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
    })
  }
}
