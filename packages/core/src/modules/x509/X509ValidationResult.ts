export interface SingleValidationResult {
  isValid: boolean
  error?: Error
  /**
   * Additional context about this validation check
   */
  details?: string
}

export interface X509CertificateValidations {
  /**
   * Chain validation includes:
   * - Chain structure is valid and complete
   * - All certificate signatures are valid
   * - All certificates are within their validity period
   * - At least one certificate matches a trusted certificate (if provided)
   */
  chain: SingleValidationResult

  /**
   * Path length constraints are satisfied
   */
  pathLength: SingleValidationResult

  /**
   * All critical extensions are understood and valid
   */
  criticalExtensions: SingleValidationResult

  /**
   * Certificates have not been revoked (CRL)
   */
  revocationStatus: SingleValidationResult

  /**
   * Key usage constraints are satisfied
   */
  keyUsage: SingleValidationResult

  /**
   * Basic constraints are valid for CA certificates
   */
  basicConstraints: SingleValidationResult
}

export interface X509ValidationResult {
  /**
   * Overall validation result - true only if all checks passed
   */
  isValid: boolean

  /**
   * Individual validation checks performed
   */
  validations: Partial<X509CertificateValidations>

  /**
   * Error that occurred during validation
   */
  error?: Error
}
