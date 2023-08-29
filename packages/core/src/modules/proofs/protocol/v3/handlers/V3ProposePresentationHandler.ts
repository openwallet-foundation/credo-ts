import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V3ProofProtocol } from '../V3ProofProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { V3ProposePresentationMessage } from '../messages/V3ProposePresentationMessage'

export class V3ProposePresentationHandler implements MessageHandler {
  private proofProtocol: V3ProofProtocol
  public supportedMessages = [V3ProposePresentationMessage]

  public constructor(proofProtocol: V3ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3ProposePresentationHandler>) {
    const proofRecord = await this.proofProtocol.processProposal(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToProposal(messageContext.agentContext, {
      proofRecord,
      proposalMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return this.acceptProposal(proofRecord, messageContext)
    }
  }
  private async acceptProposal(
    proofRecord: ProofExchangeRecord,
    messageContext: MessageHandlerInboundMessage<V3ProposePresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending request with autoAccept`)

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.proofProtocol.acceptProposal(messageContext.agentContext, { proofRecord })

    return new OutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: proofRecord,
    })
  }
}
