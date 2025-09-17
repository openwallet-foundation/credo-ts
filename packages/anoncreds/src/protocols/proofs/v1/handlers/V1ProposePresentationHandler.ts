import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import type { V1ProofProtocol } from '../V1ProofProtocol'

import { OutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { V1ProposePresentationMessage } from '../messages'

export class V1ProposePresentationHandler implements DidCommMessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1ProposePresentationMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1ProposePresentationHandler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<V1ProposePresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending request with autoAccept')

    if (!messageContext.connection) {
      messageContext.agentContext.config.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.proofProtocol.acceptProposal(messageContext.agentContext, {
      proofRecord,
    })

    return new OutboundDidCommMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: proofRecord,
    })
  }
}
