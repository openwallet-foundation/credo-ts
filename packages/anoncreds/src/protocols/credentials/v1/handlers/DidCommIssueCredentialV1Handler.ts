import type {
  DidCommCredentialExchangeRecord,
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { CredoError } from '@credo-ts/core'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { DidCommIssueCredentialV1Message as DidCommIssueCredentialV1Message } from '../messages'

export class DidCommIssueCredentialV1Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol

  public supportedMessages = [DidCommIssueCredentialV1Message]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommIssueCredentialV1Handler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<DidCommIssueCredentialV1Handler>
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
