import { EventEmitter, injectable } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutboundMessageContext } from '../../../models'
import type { DidCommTrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../DidCommTrustPingEvents'
import { DidCommTrustPingEventTypes } from '../DidCommTrustPingEvents'
import type { DidCommTrustPingMessage } from '../messages'
import { DidCommTrustPingResponseMessage } from '../messages'
import type { DidCommConnectionRecord } from '../repository'

@injectable()
export class DidCommTrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public processPing(
    { message, agentContext }: DidCommInboundMessageContext<DidCommTrustPingMessage>,
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
      const response = new DidCommTrustPingResponseMessage({
        threadId: message.threadId,
      })

      return new DidCommOutboundMessageContext(response, { agentContext, connection })
    }
  }

  public processPingResponse(inboundMessage: DidCommInboundMessageContext<DidCommTrustPingResponseMessage>) {
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
