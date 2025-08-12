import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialProtocol } from '../V2CredentialProtocol'

import { getOutboundDidCommMessageContext } from '../../../../../getOutboundDidCommMessageContext'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

export class V2OfferCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V2CredentialProtocol

  public supportedMessages = [V2OfferCredentialMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2OfferCredentialMessage>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<V2OfferCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, { credentialRecord })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialRecord,
      lastReceivedMessage: messageContext.message,
    })
  }
}
