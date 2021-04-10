import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements Handler {
  public supportedMessages = [KeylistUpdateResponseMessage]

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    // TODO It should handle the response when agent calls `await this.consumerRoutingService.createRoute(connectionRecord.verkey)` and notify about the result.
  }
}
