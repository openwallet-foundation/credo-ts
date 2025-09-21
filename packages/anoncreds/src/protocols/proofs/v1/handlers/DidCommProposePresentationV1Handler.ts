import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import type { DidCommProofV1Protocol } from '../V1ProofProtocol'

import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'

import { DidCommProposePresentationV1Message } from '../messages'

export class DidCommProposePresentationV1Handler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV1Protocol
  public supportedMessages = [DidCommProposePresentationV1Message]

  public constructor(proofProtocol: DidCommProofV1Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommProposePresentationV1Handler>) {
    const proofRecord = await this.proofProtocol.processProposal(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToProposal(messageContext.agentContext, {
      proofRecord,
      proposalMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptProposal(proofRecord, messageContext)
    }
  }

  private async acceptProposal(
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<DidCommProposePresentationV1Handler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.proofProtocol.acceptProposal(messageContext.agentContext, {
      proofRecord,
    })

    return new DidCommOutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: proofRecord,
    })
  }
}
