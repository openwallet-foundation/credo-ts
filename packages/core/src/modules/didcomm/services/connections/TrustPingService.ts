import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../../connections/TrustPingEvents'
import type { TrustPingMessage } from '../../messages'
import type { InboundMessageContext } from '../../models'
import type { ConnectionRecord } from '../../repository'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { injectable } from '../../../../plugins'
import { TrustPingEventTypes } from '../../connections/TrustPingEvents'
import { TrustPingResponseMessage } from '../../messages'
import { OutboundMessageContext } from '../../models'

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
