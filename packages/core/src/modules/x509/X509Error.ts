import { CredoError } from '../../error'
import type { X509ValidationResult } from './X509ValidationResult'

export class X509Error extends CredoError {}

/**
 * Error indicating that a CRL could not be obtained (e.g. network failure, timeout, or HTTP error)
 * from any of a distribution point's URLs.
 */
export class X509CrlUnavailableError extends X509Error {}

/**
 * Enhanced X509 error that includes detailed validation results
 */
export class X509ValidationError extends X509Error {
  public validationResult: X509ValidationResult

  constructor(message: string, validationResult: X509ValidationResult) {
    super(message)
    this.validationResult = validationResult
  }
}
