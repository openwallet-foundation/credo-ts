import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V3CredentialProtocol } from '../V3CredentialProtocol'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { AriesFrameworkError } from '../../../../../error'
import { V3IssueCredentialMessage } from '../messages/V3IssueCredentialMessage'

export class V3IssueCredentialHandler implements MessageHandler {
  private credentialProtocol: V3CredentialProtocol
  public supportedMessages = [V3IssueCredentialMessage]

  public constructor(credentialProtocol: V3CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundMessageContext<V3IssueCredentialMessage>) {
    const credentialRecord = await this.credentialProtocol.processCredential(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToCredential(messageContext.agentContext, {
      credentialRecord,
      credentialMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptCredential(credentialRecord, messageContext)
    }
  }

  private async acceptCredential(
    credentialRecord: CredentialExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V3IssueCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending acknowledgement with autoAccept`)
    const { message } = await this.credentialProtocol.acceptCredential(messageContext.agentContext, {
      credentialRecord,
    })

    const requestMessage = await this.credentialProtocol.findRequestMessage(
      messageContext.agentContext,
      credentialRecord.id
    )
    if (!requestMessage) {
      throw new AriesFrameworkError(`No request message found for credential record with id '${credentialRecord.id}'`)
    }

    return getOutboundMessageContext(messageContext.agentContext, {
      connectionRecord: messageContext.connection,
      message,
      associatedRecord: credentialRecord,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
    })
  }
}
