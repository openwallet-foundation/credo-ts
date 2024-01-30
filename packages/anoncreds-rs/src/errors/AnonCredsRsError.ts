import { AriesFrameworkError } from '@credo-ts/core'

export class AnonCredsRsError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
