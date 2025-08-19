import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import type { V1ProofProtocol } from '../V1ProofProtocol'

import { CredoError } from '@credo-ts/core'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'

import { V1PresentationMessage } from '../messages'

export class V1PresentationHandler implements DidCommMessageHandler {
  private proofProtocol: V1ProofProtocol
  public supportedMessages = [V1PresentationMessage]

  public constructor(proofProtocol: V1ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V1PresentationHandler>) {
    const proofRecord = await this.proofProtocol.processPresentation(messageContext)

    const shouldAutoRespond = await this.proofProtocol.shouldAutoRespondToPresentation(messageContext.agentContext, {
      presentationMessage: messageContext.message,
      proofRecord,
    })

    if (shouldAutoRespond) {
      return await this.acceptPresentation(proofRecord, messageContext)
    }
  }

  private async acceptPresentation(
    proofRecord: DidCommProofExchangeRecord,
    messageContext: DidCommMessageHandlerInboundMessage<V1PresentationHandler>
  ) {
    messageContext.agentContext.config.logger.info('Automatically sending acknowledgement with autoAccept')

    const requestMessage = await this.proofProtocol.findRequestMessage(messageContext.agentContext, proofRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for proof record with id '${proofRecord.id}'`)
    }

    const { message } = await this.proofProtocol.acceptPresentation(messageContext.agentContext, {
      proofRecord,
    })

    return getOutboundDidCommMessageContext(messageContext.agentContext, {
      message,
      lastReceivedMessage: messageContext.message,
      lastSentMessage: requestMessage,
      associatedRecord: proofRecord,
      connectionRecord: messageContext.connection,
    })
  }
}
