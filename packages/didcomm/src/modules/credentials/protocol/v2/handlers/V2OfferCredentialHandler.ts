import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import type { V2DidCommCredentialProtocol } from '../V2DidCommCredentialProtocol'

import { getOutboundDidCommMessageContext } from '../../../../../getOutboundDidCommMessageContext'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

export class V2OfferCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V2DidCommCredentialProtocol

  public supportedMessages = [V2OfferCredentialMessage]

  public constructor(credentialProtocol: V2DidCommCredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2OfferCredentialMessage>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<V2OfferCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, { credentialExchangeRecord })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
    })
  }
}
