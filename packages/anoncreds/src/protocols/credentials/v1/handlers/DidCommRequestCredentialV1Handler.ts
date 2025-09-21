import type {
  DidCommCredentialExchangeRecord,
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { CredoError } from '@credo-ts/core'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { DidCommRequestCredentialV1Message as DidCommRequestCredentialV1Message } from '../messages'

export class DidCommRequestCredentialV1Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol
  public supportedMessages = [DidCommRequestCredentialV1Message]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestCredentialV1Handler>) {
    const credentialExchangeRecord = await this.credentialProtocol.processRequest(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToRequest(messageContext.agentContext, {
      credentialExchangeRecord,
      requestMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptRequest(credentialExchangeRecord, messageContext)
    }
  }

  private async acceptRequest(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommRequestCredentialV1Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending credential with autoAccept')

    const offerMessage = await this.credentialProtocol.findOfferMessage(
      messageContext.agentContext,
      credentialExchangeRecord.id
    )
    if (!offerMessage) {
      throw new CredoError(`Could not find offer message for credential record with id ${credentialExchangeRecord.id}`)
    }

    const { message } = await this.credentialProtocol.acceptRequest(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: offerMessage,
    })
  }
}
