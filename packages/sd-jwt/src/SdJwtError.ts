import { AriesFrameworkError } from '@aries-framework/core'

export class SdJwtError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
