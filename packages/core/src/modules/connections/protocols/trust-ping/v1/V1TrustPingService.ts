import type { TrustPingMessage } from './messages'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../../repository/ConnectionRecord'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../TrustPingEvents'

import { EventEmitter } from '../../../../../agent/EventEmitter'
import { OutboundMessageContext } from '../../../../../agent/models'
import { injectable } from '../../../../../plugins'
import { TrustPingEventTypes } from '../TrustPingEvents'

import { TrustPingResponseMessage } from './messages'

@injectable()
export class V1TrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public processPing({ message, agentContext }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    this.eventEmitter.emit<TrustPingReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.TrustPingReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })

    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.threadId,
      })

      return new OutboundMessageContext(response, { agentContext, connection })
    }
  }

  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    const { agentContext, message } = inboundMessage

    const connection = inboundMessage.assertReadyConnection()

    this.eventEmitter.emit<TrustPingResponseReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.TrustPingResponseReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })
  }
}
