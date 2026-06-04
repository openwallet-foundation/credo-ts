/**
 * CRL Revocation Reason Codes (RFC 5280 Section 5.3.1)
 * These are bit flags used in the reasonFlags field of CRL Distribution Points
 */
export enum X509RevocationReason {
  Unused = 0, // unused(0)
  KeyCompromise = 1, // keyCompromise(1)
  CACompromise = 2, // cACompromise(2)
  AffiliationChanged = 3, // affiliationChanged(3)
  Superseded = 4, // superseded(4)
  CessationOfOperation = 5, // cessationOfOperation(5)
  CertificateHold = 6, // certificateHold(6)
  PrivilegeWithdrawn = 7, // privilegeWithdrawn(7) - not in RFC 5280, added in RFC 5759
  AACompromise = 8, // aACompromise(8)
}

/**
 * All possible revocation reason codes as a bitmask
 * Covers reasons 0-8 (9 total reasons)
 */
export const ALL_REVOCATION_REASONS_MASK = 0b111111111 // bits 0-8 set

/**
 * Represents a single CRL Distribution Point from the certificate extension
 * Based on RFC 5280 Section 4.2.1.13
 */
export interface X509CrlDistributionPoint {
  /**
   * URLs where the CRL can be fetched
   * These are mirrors - try them in order until one succeeds
   */
  urls: string[]

  /**
   * Optional reasons covered by this distribution point
   * If undefined, this distribution point covers ALL revocation reasons (a "full" DP)
   * If defined, it's a bitmask of X509RevocationReason values
   *
   * Example: [1, 2] means this DP only covers keyCompromise and cACompromise
   */
  reasons?: number[]

  /**
   * Optional CRL issuer (if different from certificate issuer)
   * Currently not supported - will be undefined
   */
  crlIssuer?: string
}
