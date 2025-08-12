import type { InboundDidCommMessageContext } from '../../../models'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../TrustPingEvents'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository'

import { EventEmitter, injectable } from '@credo-ts/core'

import { OutboundDidCommMessageContext } from '../../../models'
import { TrustPingEventTypes } from '../TrustPingEvents'
import { TrustPingResponseMessage } from '../messages'

@injectable()
export class TrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public processPing({ message, agentContext }: InboundDidCommMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
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

      return new OutboundDidCommMessageContext(response, { agentContext, connection })
    }
  }

  public processPingResponse(inboundMessage: InboundDidCommMessageContext<TrustPingResponseMessage>) {
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
