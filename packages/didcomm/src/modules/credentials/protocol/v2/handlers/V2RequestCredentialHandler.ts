import type { DidCommMessageHandler } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository'
import type { V2DidCommCredentialProtocol } from '../V2DidCommCredentialProtocol'

import { CredoError } from '@credo-ts/core'

import { getOutboundDidCommMessageContext } from '../../../../../getOutboundDidCommMessageContext'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V2DidCommCredentialProtocol

  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(credentialProtocol: V2DidCommCredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2RequestCredentialMessage>) {
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
    messageContext: InboundDidCommMessageContext<V2RequestCredentialMessage>
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
