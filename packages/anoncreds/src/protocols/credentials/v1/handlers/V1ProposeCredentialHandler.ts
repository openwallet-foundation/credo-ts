import type { V1CredentialProtocol } from '../V1CredentialProtocol'
import type { CredentialExchangeRecord, MessageHandler, MessageHandlerInboundMessage } from '@aries-framework/core'

import { OutboundMessageContext } from '@aries-framework/core'

import { V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements MessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialProtocol.processProposal(messageContext)

    const shouldAutoAcceptProposal = await this.credentialProtocol.shouldAutoRespondToProposal(
      messageContext.agentContext,
      {
        credentialRecord,
        proposalMessage: messageContext.message,
      }
    )

    if (shouldAutoAcceptProposal) {
      return await this.acceptProposal(credentialRecord, messageContext)
    }
  }

  private async acceptProposal(
    credentialRecord: CredentialExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V1ProposeCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending offer with autoAccept`)

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialProtocol.acceptProposal(messageContext.agentContext, {
      credentialRecord,
    })

    return new OutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: credentialRecord,
    })
  }
}
