import type { DidCommOutboundMessageContext } from '../models'

import { CredoError } from '@credo-ts/core'

export class MessageSendingError extends CredoError {
  public outboundMessageContext: DidCommOutboundMessageContext
  public constructor(
    message: string,
    { outboundMessageContext, cause }: { outboundMessageContext: DidCommOutboundMessageContext; cause?: Error }
  ) {
    super(message, { cause })
    this.outboundMessageContext = outboundMessageContext
  }
}
