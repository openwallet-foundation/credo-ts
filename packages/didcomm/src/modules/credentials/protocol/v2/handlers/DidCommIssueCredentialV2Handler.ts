import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'

import { CredoError } from '@credo-ts/core'

import { getOutboundDidCommMessageContext } from '../../../../../getDidCommOutboundMessageContext'
import { DidCommIssueCredentialV2Message } from '../messages/DidCommIssueCredentialV2Message'

export class DidCommIssueCredentialV2Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol
  public supportedMessages = [DidCommIssueCredentialV2Message]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommIssueCredentialV2Message>) {
    const credentialExchangeRecord = await this.credentialProtocol.processCredential(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToCredential(messageContext.agentContext, {
      credentialExchangeRecord,
      credentialMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptCredential(credentialExchangeRecord, messageContext)
    }
  }

  private async acceptCredential(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommIssueCredentialV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending acknowledgement with autoAccept')
    const { message } = await this.credentialProtocol.acceptCredential(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    const requestMessage = await this.credentialProtocol.findRequestMessage(
      messageContext.agentContext,
      credentialExchangeRecord.id
    )
    if (!requestMessage) {
      throw new CredoError(`No request message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialExchangeRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
    })
  }
}
