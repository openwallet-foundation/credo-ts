import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommEmptyMessage } from '../../../messages'

/**
 * Handle DIDComm V2 `empty/1.0/empty` messages. Per
 * https://identity.foundation/didcomm-messaging/spec/v2.1/#the-empty-message,
 * the empty message has no semantic meaning. Any rotation or termination signal it might
 * carry is delivered via the `from_prior` header which is processed in the inbound
 * pipeline ({@link DidCommMessageReceiver}) before this handler runs, so the handler is
 * intentionally a no-op.
 */
export class DidCommEmptyMessageHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommEmptyMessage]

  public async handle(_inbound: DidCommMessageHandlerInboundMessage<DidCommEmptyMessageHandler>) {
    return undefined
  }
}
