import type { X509RevocationReason } from './X509CrlDistributionPoint'

/**
 * Revocation checking mode based on Java PKIXRevocationChecker.Option patterns
 */
export enum X509RevocationCheckMode {
  /**
   * Completely disable revocation checking
   */
  Disabled = 'Disabled',

  /**
   * Check revocation status but allow validation to succeed if:
   * - CRL cannot be obtained due to network error
   * This is the RECOMMENDED default for production systems
   */
  SoftFail = 'SoftFail',

  /**
   * Require successful revocation check - fail if network unavailable or service errors
   * Use with caution in production as network failures will block certificate validation
   */
  Require = 'Require',
}

export interface X509RevocationCheckOptions {
  /**
   * Mode for revocation checking
   * @default {@link X509RevocationCheckMode.SoftFail}
   *
   * Note: Currently defaults to 'SoftFail' to provide enhanced security
   * without breaking existing functionality in network failure scenarios
   */
  mode?: X509RevocationCheckMode

  /**
   * Whether to check revocation for all certificates in chain (except root)
   * @default false (only check end-entity certificate)
   */
  checkFullChain?: boolean

  /**
   * Timeout in milliseconds for CRL fetches
   * @default 5000
   */
  timeoutMs?: number

  /**
   * Maximum size in bytes for CRL downloads
   * @default 10485760 (10 MB)
   */
  maxCrlSizeBytes?: number

  /**
   * Cache expiry time in seconds for CRL data
   * @default 3600 (1 hour)
   */
  crlCacheExpirySeconds?: number

  /**
   * The date/time to use for revocation checking
   * Used to verify CRL validity (thisUpdate/nextUpdate) and revocation dates
   * @default new Date() (current time)
   */
  verificationDate?: Date

  /**
   * Specific revocation reasons that must be covered by CRLs
   * If a certificate has no reasons specified in its CRL distribution points (a "full" DP),
   * it covers all reasons automatically.
   *
   * If a certificate only has distribution points with specific reasons, this array determines
   * which reasons must be covered for the check to be considered complete.
   *
   * @default All revocation reasons must be covered
   *
   * Set to a subset to only require coverage of specific reasons.
   */
  requiredReasons?: X509RevocationReason[]
}
