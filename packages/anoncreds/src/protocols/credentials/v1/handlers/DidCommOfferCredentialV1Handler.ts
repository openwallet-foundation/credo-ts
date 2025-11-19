import type {
  DidCommCredentialExchangeRecord,
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { V1OfferCredentialMessage as DidCommOfferCredentialV1Message } from '../messages'

export class DidCommOfferCredentialV1Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol
  public supportedMessages = [DidCommOfferCredentialV1Message]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommOfferCredentialV1Handler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<DidCommOfferCredentialV1Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')
    const { message } = await this.credentialProtocol.acceptOffer(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
    })
  }
}
