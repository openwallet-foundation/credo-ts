export interface X509CertificateSingleValidationResult {
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
  chain: X509CertificateSingleValidationResult

  /**
   * Path length constraints are satisfied
   */
  pathLength: X509CertificateSingleValidationResult

  /**
   * All critical extensions are understood and valid
   */
  criticalExtensions: X509CertificateSingleValidationResult

  /**
   * Certificates have not been revoked (CRL)
   */
  revocationStatus: X509CertificateSingleValidationResult

  /**
   * Key usage constraints are satisfied
   */
  keyUsage: X509CertificateSingleValidationResult

  /**
   * Basic constraints are valid for CA certificates
   */
  basicConstraints: X509CertificateSingleValidationResult
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
   * The error that caused validation to fail. Validation is fail-fast: it stops
   * at the first failing check.
   */
  error?: Error
}
