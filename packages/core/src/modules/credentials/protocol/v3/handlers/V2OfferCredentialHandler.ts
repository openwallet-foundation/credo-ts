import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialProtocol } from '../V3CredentialProtocol'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { V3OfferCredentialMessage } from '../messages/V3OfferCredentialMessage'

export class V2OfferCredentialHandler implements MessageHandler {
  private credentialProtocol: V2CredentialProtocol

  public supportedMessages = [V3OfferCredentialMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundMessageContext<V3OfferCredentialMessage>) {
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
    messageContext: MessageHandlerInboundMessage<V2OfferCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending request with autoAccept`)

    const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, { credentialRecord })

    return getOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialRecord,
      lastReceivedMessage: messageContext.message,
    })
  }
}
