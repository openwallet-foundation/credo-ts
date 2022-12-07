import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { PingReceivedEvent, PingResponseReceivedEvent } from '../../../ConnectionEvents'
import type { ConnectionRecord } from '../../../repository'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { inject, injectable } from '../../../../../plugins'
import { ConnectionEventTypes } from '../../../ConnectionEvents'

import { TrustPingMessageHandler, TrustPingResponseMessageHandler } from './handlers'
import { TrustPingMessage } from './messages/TrustPingMessage'
import { TrustPingResponseMessage } from './messages/TrustPingResponseMessage'

@injectable()
export class V2TrustPingService {
  private logger: Logger
  private dispatcher: Dispatcher
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter
  ) {
    this.logger = logger
    this.dispatcher = dispatcher
    this.eventEmitter = eventEmitter

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

  public processPing({ agentContext, message }: InboundMessageContext<TrustPingMessage>) {
    this.logger.info('Trust Ping message received.', message)

    this.eventEmitter.emit<PingReceivedEvent>(agentContext, {
      type: ConnectionEventTypes.PingReceived,
      payload: {
        from: message.from,
      },
    })

    if (message.body.responseRequested) {
      return new TrustPingResponseMessage({
        from: message.to?.length ? message.to[0] : undefined,
        to: message.from,
        body: {},
        thid: message.id,
      })
    }
  }

  public processPingResponse({ agentContext, message }: InboundMessageContext<TrustPingResponseMessage>) {
    this.logger.info('Trust Ping Response message received.', message)

    this.eventEmitter.emit<PingResponseReceivedEvent>(agentContext, {
      type: ConnectionEventTypes.PingResponseReceived,
      payload: {
        from: message.from,
      },
    })
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this))
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this))
  }
}
