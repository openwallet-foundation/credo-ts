import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../../repository'
import type { V2TrustPingReceivedEvent, V2TrustPingResponseReceivedEvent } from '../TrustPingEvents'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { inject, injectable } from '../../../../../plugins'
import { TrustPingEventTypes } from '../TrustPingEvents'

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

    this.eventEmitter.emit<V2TrustPingReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.V2TrustPingReceivedEvent,
      payload: {
        message: message,
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

  public processPingResponse({ agentContext, message, connection }: InboundMessageContext<TrustPingResponseMessage>) {
    this.logger.info('Trust Ping Response message received.', message)

    this.eventEmitter.emit<V2TrustPingResponseReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.V2TrustPingResponseReceivedEvent,
      payload: {
        message: message,
        connectionRecord: connection,
      },
    })
  }
}
