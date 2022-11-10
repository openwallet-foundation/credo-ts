import type { OutboundDIDCommV1Message } from '../types'

import { AriesFrameworkError } from './AriesFrameworkError'

export class MessageSendingError extends AriesFrameworkError {
  public outboundMessage: OutboundDIDCommV1Message
  public constructor(
    message: string,
    { outboundMessage, cause }: { outboundMessage: OutboundDIDCommV1Message; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessage = outboundMessage
  }
}
