import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingMessageOptions } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { createOutboundMessage } from '../../../agent/helpers'
import { TrustPingMessage, TrustPingResponseMessage } from '../messages'

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

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * @param options optional trust ping options
   * @returns outbound message containing trust ping message
   */
  public async createTrustPing(options: TrustPingMessageOptions = {}): Promise<TrustPingMessage> {
    return new TrustPingMessage(options)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    // TODO: handle ping response message
  }
}
