import type { OutboundMessage } from '../types'

import { AriesFrameworkError } from './AriesFrameworkError'

export class MessageSendingError extends AriesFrameworkError {
  public outboundMessage: OutboundMessage
  public constructor(message: string, { outboundMessage, cause }: { outboundMessage: OutboundMessage; cause?: Error }) {
    super(message, { cause })
    this.outboundMessage = outboundMessage
  }
}
