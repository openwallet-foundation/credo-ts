import type {
  DidCommCredentialExchangeRecord,
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { DidCommProposeCredentialV1Message } from '../messages'

export class DidCommProposeCredentialV1Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol
  public supportedMessages = [DidCommProposeCredentialV1Message]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommProposeCredentialV1Handler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<DidCommProposeCredentialV1Handler>
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
