import { Lifecycle, scoped } from 'tsyringe'

import { createOutboundMessage } from '../../../agent/helpers'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { TrustPingMessage, TrustPingResponseMessage } from '../messages'
import { ConnectionRecord } from '../repository/ConnectionRecord'

@scoped(Lifecycle.ContainerScoped)
export class TrustPingService {
  public processPing({ message }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.id,
      })

      return createOutboundMessage(connection, response)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    // TODO: handle ping response message
  }
}
