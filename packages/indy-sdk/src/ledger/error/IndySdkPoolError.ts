import { CredoError } from '@credo-ts/core'

export class IndySdkPoolError extends CredoError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
