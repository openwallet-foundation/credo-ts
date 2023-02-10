import { AriesFrameworkError } from '@aries-framework/core'

export class AnonCredsRsError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
