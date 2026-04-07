import { CredoError } from '../../error'
import type { X509ValidationResult } from './X509ValidationResult'

export class X509Error extends CredoError {}

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
