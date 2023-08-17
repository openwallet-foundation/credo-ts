import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2BasicMessageProtocol } from '../V2BasicMessageProtocol'

import { V2BasicMessage } from '../messages'

export class V2BasicMessageHandler implements MessageHandler {
  private basicMessageProtocol: V2BasicMessageProtocol
  public supportedMessages = [V2BasicMessage]

  public constructor(basicMessageProtocol: V2BasicMessageProtocol) {
    this.basicMessageProtocol = basicMessageProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2BasicMessageHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageProtocol.save(messageContext, connection)
  }
}
