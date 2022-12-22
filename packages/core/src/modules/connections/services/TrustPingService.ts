import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { EventEmitter } from '../../../agent/EventEmitter'
import { OutboundMessageContext } from '../../../agent/models'
import { injectable } from '../../../plugins'
import { TrustPingResponseMessage } from '../messages'
import { TrustPingEventTypes } from '../TrustPingEvents'
import { TrustPingRequestEvent, TrustPingResponseEvent } from '../TrustPingEvents'

@injectable()
export class TrustPingService {
  private eventEmitter: EventEmitter

  public constructor(
    eventEmitter: EventEmitter
  ) {
    this.eventEmitter = eventEmitter
  }

  public processPing({ message, agentContext }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {

    this.eventEmitter.emit<TrustPingRequestEvent>(agentContext, {
      type: TrustPingEventTypes.TrustPingRequestEvent,
      payload: {
        connectionRecord: connection,
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

    const { agentContext, connection } = inboundMessage

    if (connection) {
      this.eventEmitter.emit<TrustPingResponseEvent>(agentContext, {
        type: TrustPingEventTypes.TrustPingResponseEvent,
        payload: {
          connectionRecord: connection,
        },
      })
    }
  }
}
