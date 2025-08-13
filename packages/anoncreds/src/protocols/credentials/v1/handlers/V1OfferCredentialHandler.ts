import type { DidCommCredentialExchangeRecord, DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { V1CredentialProtocol } from '../V1DidCommCredentialProtocol'

import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { V1OfferCredentialMessage } from '../messages'

export class V1OfferCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1OfferCredentialMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1OfferCredentialHandler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<V1OfferCredentialHandler>
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
