import { BaseError } from './BaseError'

export class AriesFrameworkError extends BaseError {
  /**
   * Create base AriesFrameworkError.
   * @param message the error message
   * @param cause the error that caused this error to be created
   */
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, cause)
  }
}
