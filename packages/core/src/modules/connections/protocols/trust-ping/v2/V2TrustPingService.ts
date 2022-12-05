import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../../repository'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { inject, injectable } from '../../../../../plugins'

import { TrustPingMessageHandler, TrustPingResponseMessageHandler } from './handlers'
import { TrustPingMessage } from './messages/TrustPingMessage'
import { TrustPingResponseMessage } from './messages/TrustPingResponseMessage'

@injectable()
export class V2TrustPingService {
  private logger: Logger
  private dispatcher: Dispatcher

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, dispatcher: Dispatcher) {
    this.logger = logger
    this.dispatcher = dispatcher

    this.registerHandlers()
  }

  public createPing(connection: ConnectionRecord): TrustPingMessage {
    this.logger.info(`Send Trust Ping message to DID ${connection.theirDid}.`)
    return new TrustPingMessage({
      from: connection.did,
      to: connection.theirDid,
      body: {
        responseRequested: true,
      },
    })
  }

  public processPing({ message }: InboundMessageContext<TrustPingMessage>) {
    this.logger.info('Trust Ping message received.', message)
    if (message.body.responseRequested) {
      return new TrustPingResponseMessage({
        from: message.to?.length ? message.to[0] : undefined,
        to: message.from,
        body: {},
        thid: message.id,
      })
    }
  }

  public processPingResponse({ message }: InboundMessageContext<TrustPingResponseMessage>) {
    this.logger.info('Trust Ping Response message received.', message)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this))
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this))
  }
}
