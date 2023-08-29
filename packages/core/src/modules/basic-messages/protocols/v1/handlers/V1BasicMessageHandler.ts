import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V1BasicMessageProtocol } from '../V1BasicMessageProtocol'

import { V1BasicMessage } from '../messages'

export class V1BasicMessageHandler implements MessageHandler {
  private basicMessageProtocol: V1BasicMessageProtocol
  public supportedMessages = [V1BasicMessage]

  public constructor(basicMessageProtocol: V1BasicMessageProtocol) {
    this.basicMessageProtocol = basicMessageProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1BasicMessageHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageProtocol.save(messageContext, connection)
  }
}
