import { CredoError } from '../../error'

export class MdocError extends CredoError {}

/**
 * Thrown when a response is received for an mdoc verification session that has expired.
 *
 * Separate from {@link MdocError} so callers can distinguish an expired session (the wallet took
 * too long, and the session can be retried with a new request) from an actual verification failure.
 */
export class MdocVerificationSessionExpiredError extends MdocError {
  public constructor(
    public readonly expiresAt: Date,
    message = `The mdoc DC API verification session has expired at ${expiresAt.toISOString()}`
  ) {
    super(message)
  }
}
