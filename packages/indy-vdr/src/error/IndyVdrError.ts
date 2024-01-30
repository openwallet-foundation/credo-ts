import { AriesFrameworkError } from '@credo-ts/core'

export class IndyVdrError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
