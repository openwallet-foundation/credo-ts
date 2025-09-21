import type { DidCommMessageHandler } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'

import { CredoError } from '@credo-ts/core'

import { getDidCommOutboundMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import { DidCommRequestCredentialV2Message } from '../messages/DidCommRequestCredentialV2Message'

export class DidCommRequestCredentialV2Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol

  public supportedMessages = [DidCommRequestCredentialV2Message]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommRequestCredentialV2Message>) {
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
    messageContext: DidCommInboundMessageContext<DidCommRequestCredentialV2Message>
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

    return getDidCommOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: offerMessage,
    })
  }
}
