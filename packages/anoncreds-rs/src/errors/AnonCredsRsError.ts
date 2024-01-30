import { CredoError } from '@credo-ts/core'

export class AnonCredsRsError extends CredoError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
