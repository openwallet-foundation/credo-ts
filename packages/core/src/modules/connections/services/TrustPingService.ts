import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../TrustPingEvents'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { EventEmitter } from '../../../agent/EventEmitter'
import { OutboundMessageContext } from '../../../agent/models'
import { injectable } from '../../../plugins'
import { TrustPingEventTypes } from '../TrustPingEvents'
import { TrustPingResponseMessage } from '../messages'

@injectable()
export class TrustPingService {
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
        threadId: message.id,
      })

      return new OutboundMessageContext(response, { agentContext, connection })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    const { agentContext, connection, message } = inboundMessage

    if (connection) {
      this.eventEmitter.emit<TrustPingResponseReceivedEvent>(agentContext, {
        type: TrustPingEventTypes.TrustPingResponseReceivedEvent,
        payload: {
          connectionRecord: connection,
          message: message,
        },
      })
    }
  }
}
