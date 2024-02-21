import type { OutboundMessageContext } from '../agent/models'

import { CredoError } from './CredoError'

export class MessageSendingError extends CredoError {
  public outboundMessageContext: OutboundMessageContext
  public constructor(
    message: string,
    { outboundMessageContext, cause }: { outboundMessageContext: OutboundMessageContext; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessageContext = outboundMessageContext
  }
}
