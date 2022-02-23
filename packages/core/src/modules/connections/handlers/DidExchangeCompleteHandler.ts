import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { OutOfBandRepository } from '../../oob/repository'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { AriesFrameworkError } from '../../../error'
import { DidExchangeCompleteMessage } from '../messages'
import { HandshakeProtocol } from '../models'

export class DidExchangeCompleteHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandRepository: OutOfBandRepository
  public supportedMessages = [DidExchangeCompleteMessage]

  public constructor(didExchangeProtocol: DidExchangeProtocol, outOfBandRepository: OutOfBandRepository) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandRepository = outOfBandRepository
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeCompleteHandler>) {
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
    const outOfBandRecord = await this.outOfBandRepository.findSingleByQuery({
      messageId: message.thread?.parentThreadId,
    })

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    await this.didExchangeProtocol.processComplete(messageContext, outOfBandRecord)
  }
}
