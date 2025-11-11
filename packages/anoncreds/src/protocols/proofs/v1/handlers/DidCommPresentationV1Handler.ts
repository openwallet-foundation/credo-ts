import { CredoError } from '@credo-ts/core'
import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import { getOutboundDidCommMessageContext } from '@credo-ts/didcomm'
import type { DidCommProofV1Protocol } from '../DidCommProofV1Protocol'

import { DidCommPresentationV1Message } from '../messages'

export class DidCommPresentationV1Handler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofV1Protocol
  public supportedMessages = [DidCommPresentationV1Message]

  public constructor(proofProtocol: DidCommProofV1Protocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV1Handler>) {
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
    messageContext: DidCommMessageHandlerInboundMessage<DidCommPresentationV1Handler>
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
