import type {
  DidCommCredentialExchangeRecord,
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import type { V1CredentialProtocol } from '../V1DidCommCredentialProtocol'

import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements DidCommMessageHandler {
  private credentialProtocol: V1CredentialProtocol
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(credentialProtocol: V1CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialExchangeRecord = await this.credentialProtocol.processProposal(messageContext)

    const shouldAutoAcceptProposal = await this.credentialProtocol.shouldAutoRespondToProposal(
      messageContext.agentContext,
      {
        credentialExchangeRecord,
        proposalMessage: messageContext.message,
      }
    )

    if (shouldAutoAcceptProposal) {
      return await this.acceptProposal(credentialExchangeRecord, messageContext)
    }
  }

  private async acceptProposal(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<V1ProposeCredentialHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending offer with autoAccept')

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialProtocol.acceptProposal(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      message,
      connectionRecord: messageContext.connection,
      associatedRecord: credentialExchangeRecord,
    })
  }
}
