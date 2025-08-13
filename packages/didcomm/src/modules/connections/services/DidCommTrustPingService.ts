import type { InboundDidCommMessageContext } from '../../../models'
import type { DidCommTrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../DidCommTrustPingEvents'
import type { TrustPingMessage } from '../messages'
import type { DidCommConnectionRecord } from '../repository'

import { EventEmitter, injectable } from '@credo-ts/core'

import { OutboundDidCommMessageContext } from '../../../models'
import { DidCommTrustPingEventTypes } from '../DidCommTrustPingEvents'
import { TrustPingResponseMessage } from '../messages'

@injectable()
export class DidCommTrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public processPing(
    { message, agentContext }: InboundDidCommMessageContext<TrustPingMessage>,
    connection: DidCommConnectionRecord
  ) {
    this.eventEmitter.emit<DidCommTrustPingReceivedEvent>(agentContext, {
      type: DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent,
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
      type: DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })
  }
}
