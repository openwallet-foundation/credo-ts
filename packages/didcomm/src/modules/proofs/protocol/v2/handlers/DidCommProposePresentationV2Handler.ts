import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofExchangeRecord } from '../../../repository/DidCommProofExchangeRecord'
import type { V2DidCommProofProtocol } from '../DidCommProofV2Protocol'

import { DidCommOutboundMessageContext } from '../../../../../models'
import { DidCommProposePresentationV2Message } from '../messages/DidCommProposePresentationV2Message'

export class DidCommProposePresentationV2Handler implements DidCommMessageHandler {
  private proofProtocol: V2DidCommProofProtocol
  public supportedMessages = [DidCommProposePresentationV2Message]

  public constructor(proofProtocol: V2DidCommProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommProposePresentationV2Handler>) {
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
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommProposePresentationV2Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.proofProtocol.acceptProposal(messageContext.agentContext, { proofRecord })

    return new DidCommOutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: proofRecord,
    })
  }
}
