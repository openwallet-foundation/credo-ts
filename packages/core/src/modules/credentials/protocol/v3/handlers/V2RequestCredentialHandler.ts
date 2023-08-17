import type { MessageHandler } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialProtocol } from '../V3CredentialProtocol'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { AriesFrameworkError } from '../../../../../error'
import { V3RequestCredentialMessage } from '../messages/V3RequestCredentialMessage'

export class V2RequestCredentialHandler implements MessageHandler {
  private credentialProtocol: V2CredentialProtocol

  public supportedMessages = [V3RequestCredentialMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundMessageContext<V3RequestCredentialMessage>) {
    const credentialRecord = await this.credentialProtocol.processRequest(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToRequest(messageContext.agentContext, {
      credentialRecord,
      requestMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptRequest(credentialRecord, messageContext)
    }
  }

  private async acceptRequest(
    credentialRecord: CredentialExchangeRecord,
    messageContext: InboundMessageContext<V3RequestCredentialMessage>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending credential with autoAccept`)

    const offerMessage = await this.credentialProtocol.findOfferMessage(
      messageContext.agentContext,
      credentialRecord.id
    )
    if (!offerMessage) {
      throw new AriesFrameworkError(`Could not find offer message for credential record with id ${credentialRecord.id}`)
    }

    const { message } = await this.credentialProtocol.acceptRequest(messageContext.agentContext, {
      credentialRecord,
    })

    return getOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: offerMessage,
    })
  }
}
