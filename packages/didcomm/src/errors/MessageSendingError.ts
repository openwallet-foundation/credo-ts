import { CredoError } from '@credo-ts/core'
import type { DidCommOutboundMessageContext } from '../models'

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
