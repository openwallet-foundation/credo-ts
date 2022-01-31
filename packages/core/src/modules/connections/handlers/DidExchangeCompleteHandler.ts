import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { AriesFrameworkError } from '../../../error'
import { DidExchangeCompleteMessage } from '../messages'
import { HandshakeProtocol } from '../models'

export class DidExchangeCompleteHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  public supportedMessages = [DidExchangeCompleteMessage]

  public constructor(didExchangeProtocol: DidExchangeProtocol) {
    this.didExchangeProtocol = didExchangeProtocol
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeCompleteHandler>) {
    const { connection: connectionRecord } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection is missing in message context`)
    }

    const { protocol } = connectionRecord
    if (protocol !== HandshakeProtocol.DidExchange) {
      throw new AriesFrameworkError(
        `Connection record protol is ${protocol} but handler supports only ${HandshakeProtocol.DidExchange}.`
      )
    }

    await this.didExchangeProtocol.processComplete(messageContext)
  }
}
