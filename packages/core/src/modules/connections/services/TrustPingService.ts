import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { createOutboundMessage } from '../../../agent/helpers'
import { injectable } from '../../../plugins'
import { TrustPingResponseMessage } from '../messages'

@injectable()
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
