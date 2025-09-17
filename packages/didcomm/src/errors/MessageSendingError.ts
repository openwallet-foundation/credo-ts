import type { OutboundDidCommMessageContext } from '../models'

import { CredoError } from '@credo-ts/core'

export class MessageSendingError extends CredoError {
  public outboundMessageContext: OutboundDidCommMessageContext
  public constructor(
    message: string,
    { outboundMessageContext, cause }: { outboundMessageContext: OutboundDidCommMessageContext; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessageContext = outboundMessageContext
  }
}
