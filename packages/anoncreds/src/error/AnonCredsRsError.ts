import { AnonCredsError } from './AnonCredsError'

export class AnonCredsRsError extends AnonCredsError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
