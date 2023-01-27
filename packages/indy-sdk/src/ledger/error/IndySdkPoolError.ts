import { AriesFrameworkError } from '@aries-framework/core'

export class IndySdkPoolError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
