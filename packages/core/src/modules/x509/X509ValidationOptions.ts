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
   * Whether to check revocation for all certificates in the chain (except the root).
   *
   * Defaults to `true`, so every certificate in the chain (the end-entity and any intermediate CAs)
   * is checked, as RFC 5280 expects. Set to `false` to only check the end-entity/leaf certificate,
   * which is faster but weaker.
   *
   * @default true
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
   * How long (in seconds) a verified CRL is served from the cache without contacting the
   * distribution point. After this period the CRL bytes are fetched again: when unchanged (same
   * SHA-256) the cached CRL is reused without re-parsing or re-verifying, otherwise it is fully
   * re-verified. Independently of this period, a cached CRL is never served past its own
   * `nextUpdate`. When unset in per-call revocation options, the value configured on the X509
   * module's `revocationCheck` applies.
   *
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
   * @default The reasons actually published across the certificate's CRL distribution points.
   * There is no point requiring coverage of reasons the issuer never published a distribution point
   * for, so by default only the reasons present in the certificate's DPs are required.
   *
   * Set to a subset to only require coverage of specific reasons.
   */
  requiredReasons?: X509RevocationReason[]
}
