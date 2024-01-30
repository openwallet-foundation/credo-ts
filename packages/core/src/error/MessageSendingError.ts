import type { OutboundMessageContext } from '../agent/models'

import { AriesFrameworkError } from './CredoError'

export class MessageSendingError extends AriesFrameworkError {
  public outboundMessageContext: OutboundMessageContext
  public constructor(
    message: string,
    { outboundMessageContext, cause }: { outboundMessageContext: OutboundMessageContext; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessageContext = outboundMessageContext
  }
}
