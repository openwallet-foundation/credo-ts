import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { InboundDidCommMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import type { V2DidCommCredentialProtocol } from '../V2DidCommCredentialProtocol'

import { CredoError } from '@credo-ts/core'

import { getOutboundDidCommMessageContext } from '../../../../../getOutboundDidCommMessageContext'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'

export class V2IssueCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V2DidCommCredentialProtocol
  public supportedMessages = [V2IssueCredentialMessage]

  public constructor(credentialProtocol: V2DidCommCredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundDidCommMessageContext<V2IssueCredentialMessage>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<V2IssueCredentialHandler>
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
