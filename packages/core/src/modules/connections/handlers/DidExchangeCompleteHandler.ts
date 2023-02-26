import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { AriesFrameworkError } from '../../../error'
import { tryParseDid } from '../../dids/domain/parse'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeCompleteMessage } from '../messages'
import { HandshakeProtocol } from '../models'

export class DidExchangeCompleteHandler implements MessageHandler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandService
  public supportedMessages = [DidExchangeCompleteMessage]

  public constructor(didExchangeProtocol: DidExchangeProtocol, outOfBandService: OutOfBandService) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DidExchangeCompleteHandler>) {
    const { connection: connectionRecord } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection is missing in message context`)
    }

    const { protocol } = connectionRecord
    if (protocol !== HandshakeProtocol.DidExchange) {
      throw new AriesFrameworkError(
        `Connection record protocol is ${protocol} but handler supports only ${HandshakeProtocol.DidExchange}.`
      )
    }

    const { message } = messageContext
    const parentThreadId = message.thread?.parentThreadId
    if (!parentThreadId) {
      throw new AriesFrameworkError(`Message does not contain pthid attribute`)
    }
    const outOfBandRecord = await this.outOfBandService.findByCreatedInvitationId(
      messageContext.agentContext,
      parentThreadId,
      tryParseDid(parentThreadId) ? message.threadId : undefined
    )

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    if (!outOfBandRecord.reusable) {
      await this.outOfBandService.updateState(messageContext.agentContext, outOfBandRecord, OutOfBandState.Done)
    }
    await this.didExchangeProtocol.processComplete(messageContext, outOfBandRecord)
  }
}
