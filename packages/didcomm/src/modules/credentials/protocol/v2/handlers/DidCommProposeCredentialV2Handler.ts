import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'
import { DidCommProposeCredentialV2Message } from '../messages/DidCommProposeCredentialV2Message'

export class DidCommProposeCredentialV2Handler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV2Protocol

  public supportedMessages = [DidCommProposeCredentialV2Message]

  public constructor(credentialProtocol: DidCommCredentialV2Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommProposeCredentialV2Message>) {
    const credentialExchangeRecord = await this.credentialProtocol.processProposal(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToProposal(messageContext.agentContext, {
      credentialExchangeRecord,
      proposalMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptProposal(credentialExchangeRecord, messageContext)
    }
  }

  private async acceptProposal(
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommProposeCredentialV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending offer with autoAccept')

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialProtocol.acceptProposal(messageContext.agentContext, {
      credentialExchangeRecord,
    })

    return new DidCommOutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: credentialExchangeRecord,
    })
  }
}
