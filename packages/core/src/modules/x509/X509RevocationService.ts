import type { AgentContext } from '../../agent'

import { fetchCrl } from './utils/crlFetcher'
import { X509Certificate } from './X509Certificate'
import { X509CertificateRevocationList } from './X509CertificateRevocationList'
import { ALL_REVOCATION_REASONS_MASK, X509RevocationReason } from './X509CrlDistributionPoint'
import { X509Error } from './X509Error'
import { X509RevocationCheckMode, type X509RevocationCheckOptions } from './X509ValidationOptions'

export interface X509RevocationCheckResult {
  isValid: boolean
  isRevoked?: boolean
  error?: Error
  details?: string
  method?: 'crl'
}

// biome-ignore lint/complexity/noStaticOnlyClass: Service class pattern used in Credo
export class X509RevocationService {
  /**
   * Checks the revocation status of a certificate using CRL
   * @param agentContext The agent context
   * @param certificate The certificate to check
   * @param issuerCertificate The issuer certificate (needed to verify CRL signature)
   * @param options Revocation check options
   * @returns Revocation check result
   */
  public static async checkRevocation(
    agentContext: AgentContext,
    certificate: X509Certificate,
    issuerCertificate: X509Certificate,
    options: X509RevocationCheckOptions
  ): Promise<X509RevocationCheckResult> {
    const mode = options.mode ?? X509RevocationCheckMode.SoftFail

    if (mode === X509RevocationCheckMode.Disabled) {
      return { isValid: true, details: 'Revocation checking disabled' }
    }

    try {
      return await X509RevocationService.checkCrl(agentContext, certificate, issuerCertificate, options)
    } catch (error) {
      return X509RevocationService.handleRevocationError(error, mode)
    }
  }

  /**
   * Checks the revocation status of a certificate using CRL with proper reason partitioning
   * Based on RFC 5280 Section 5.2.5
   */
  private static async checkCrl(
    agentContext: AgentContext,
    certificate: X509Certificate,
    issuerCertificate: X509Certificate,
    options: X509RevocationCheckOptions
  ): Promise<X509RevocationCheckResult> {
    // Get CRL distribution points from certificate
    const distributionPoints = certificate.crlDistributionPoints
    if (distributionPoints.length === 0) {
      return {
        isValid: true,
        details: 'No CRL distribution points in certificate',
      }
    }

    const verificationDate = options.verificationDate ?? new Date()

    // Step 1: Check if there's a "full" distribution point (one with no reasons specified)
    const fullDistributionPoint = distributionPoints.find((dp) => dp.reasons === undefined)

    if (fullDistributionPoint) {
      // Full DP covers all reasons - just fetch and check this one CRL
      return await X509RevocationService.checkDistributionPoint(
        agentContext,
        certificate,
        issuerCertificate,
        fullDistributionPoint,
        verificationDate,
        options
      )
    }

    // Step 2: No full DP - need to ensure required reasons are covered by fetching multiple CRLs
    // Calculate which reasons we need to cover
    // Default: require all reasons that are actually present in the certificate's DPs
    // (no point requiring reasons the issuer never published DPs for)
    const requiredReasonsMask = options.requiredReasons
      ? X509RevocationService.calculateReasonMask(options.requiredReasons)
      : X509RevocationService.calculateAllReasonsInDPs(distributionPoints)

    let coveredReasons = 0 // Bitmask of covered reason codes
    const allRevokedEntries: Array<{ serialNumber: string; revocationDate: Date; reason?: number }> = []
    const fetchedDPs: string[] = []
    const fetchErrors: string[] = [] // Track errors for DPs we couldn't fetch
    const unsupportedDPs: Array<{ reasons: number; feature: string }> = [] // Track DPs we can't process

    for (const dp of distributionPoints) {
      // Calculate which reasons this DP covers
      const dpReasonMask = X509RevocationService.calculateReasonMask(dp.reasons)

      // Check if this DP adds any new coverage for reasons we care about
      const newCoverage = dpReasonMask & requiredReasonsMask & ~coveredReasons
      if (newCoverage === 0) {
        // This DP doesn't add any new reason coverage for required reasons, skip it
        continue
      }

      // Check for unsupported features
      if (dp.crlIssuer !== undefined) {
        // This DP uses an indirect CRL (different issuer) which we don't support
        // Track it but don't fail immediately - we might cover these reasons with other DPs
        unsupportedDPs.push({ reasons: dpReasonMask, feature: `crlIssuer (${dp.crlIssuer})` })
        continue
      }

      // Try to fetch CRL from this distribution point
      const result = await X509RevocationService.fetchAndVerifyCrl(
        agentContext,
        dp.urls,
        issuerCertificate,
        verificationDate,
        options
      )

      if (!result.success) {
        // CRL fetch failed - track the error but don't fail immediately
        // Another DP might cover the same reasons
        fetchErrors.push(`URLs ${dp.urls.join(', ')}: ${result.error}`)
        continue
      }

      // Successfully fetched CRL - mark these reasons as covered
      coveredReasons |= dpReasonMask
      fetchedDPs.push(result.usedUrl)

      // Collect all revoked entries from this CRL
      allRevokedEntries.push(...result.crl.revokedCertificates)

      // Check if we've covered all required reasons
      if ((coveredReasons & requiredReasonsMask) === requiredReasonsMask) {
        break
      }
    }

    // Step 3: Verify we covered all required revocation reasons
    if ((coveredReasons & requiredReasonsMask) !== requiredReasonsMask) {
      const missingReasons = requiredReasonsMask & ~coveredReasons
      const coveredNames = X509RevocationService.reasonMaskToNames(coveredReasons)
      const requiredNames = X509RevocationService.reasonMaskToNames(requiredReasonsMask)
      const missingNames = X509RevocationService.reasonMaskToNames(missingReasons)

      // Build detailed error message
      let errorMsg =
        `Unable to cover all required revocation reasons. ` +
        `Covered: [${coveredNames.join(', ')}], ` +
        `Required: [${requiredNames.join(', ')}], ` +
        `Missing: [${missingNames.join(', ')}]. ` +
        `Certificate revocation status cannot be fully determined.`

      // Include unsupported DP info if any missing reasons could have been covered by them
      for (const unsupported of unsupportedDPs) {
        if (unsupported.reasons & missingReasons) {
          const unsupportedReasons = X509RevocationService.reasonMaskToNames(unsupported.reasons & missingReasons)
          errorMsg += ` Unsupported CRL feature ${unsupported.feature} covers missing reasons: [${unsupportedReasons.join(', ')}].`
        }
      }

      if (fetchErrors.length > 0) {
        errorMsg += ` Fetch errors: ${fetchErrors.join('; ')}`
      }

      throw new X509Error(errorMsg)
    }

    // Step 4: Check if certificate is in any of the collected revoked entries
    const certSerial = certificate.data.serialNumber
    const revokedEntry = allRevokedEntries.find((entry) => entry.serialNumber === certSerial)

    if (revokedEntry) {
      return {
        isValid: false,
        isRevoked: true,
        error: new X509Error(
          `Certificate '${certificate.subject}' has been revoked. ` +
            `Revocation date: ${revokedEntry.revocationDate.toISOString()}` +
            (revokedEntry.reason !== undefined ? `, reason: ${revokedEntry.reason}` : '')
        ),
        details: `Revoked on ${revokedEntry.revocationDate.toISOString()}`,
        method: 'crl',
      }
    }

    // Certificate not found in any CRL - it's valid
    return {
      isValid: true,
      isRevoked: false,
      details: `Certificate not found in CRLs from: ${fetchedDPs.join(', ')}`,
      method: 'crl',
    }
  }

  /**
   * Calculate bitmask of revocation reasons covered by a distribution point
   */
  private static calculateReasonMask(reasons: number[] | undefined): number {
    if (!reasons || reasons.length === 0) {
      // No reasons specified means this DP covers ALL reasons
      return ALL_REVOCATION_REASONS_MASK
    }

    // Convert array of reason codes to bitmask
    let mask = 0
    for (const reason of reasons) {
      if (reason >= 0 && reason <= 8) {
        mask |= 1 << reason
      }
    }
    return mask
  }

  /**
   * Calculate the union of all reasons present in distribution points
   * Used to determine the default required reasons (no point requiring reasons the issuer never published)
   */
  private static calculateAllReasonsInDPs(
    distributionPoints: Array<{ urls: string[]; reasons?: number[]; crlIssuer?: string }>
  ): number {
    let allReasons = 0
    for (const dp of distributionPoints) {
      allReasons |= X509RevocationService.calculateReasonMask(dp.reasons)
    }
    return allReasons
  }

  /**
   * Convert a bitmask of revocation reasons to human-readable names
   */
  private static reasonMaskToNames(mask: number): string[] {
    const names: string[] = []
    const reasonNames: Record<number, string> = {
      [X509RevocationReason.Unused]: 'unused',
      [X509RevocationReason.KeyCompromise]: 'keyCompromise',
      [X509RevocationReason.CACompromise]: 'cACompromise',
      [X509RevocationReason.AffiliationChanged]: 'affiliationChanged',
      [X509RevocationReason.Superseded]: 'superseded',
      [X509RevocationReason.CessationOfOperation]: 'cessationOfOperation',
      [X509RevocationReason.CertificateHold]: 'certificateHold',
      [X509RevocationReason.PrivilegeWithdrawn]: 'privilegeWithdrawn',
      [X509RevocationReason.AACompromise]: 'aACompromise',
    }

    for (let i = 0; i <= 8; i++) {
      if (mask & (1 << i)) {
        names.push(reasonNames[i] ?? `unknown(${i})`)
      }
    }

    return names
  }

  /**
   * Check revocation status using a single distribution point (typically a "full" DP)
   */
  private static async checkDistributionPoint(
    agentContext: AgentContext,
    certificate: X509Certificate,
    issuerCertificate: X509Certificate,
    distributionPoint: { urls: string[]; reasons?: number[] },
    verificationDate: Date,
    options: X509RevocationCheckOptions
  ): Promise<X509RevocationCheckResult> {
    const result = await X509RevocationService.fetchAndVerifyCrl(
      agentContext,
      distributionPoint.urls,
      issuerCertificate,
      verificationDate,
      options
    )

    if (!result.success) {
      throw new X509Error(
        `Failed to fetch CRL from distribution point (URLs: ${distributionPoint.urls.join(', ')}). ` +
          `Error: ${result.error}`
      )
    }

    // Check if certificate is in the CRL
    const revokedEntry = result.crl.findRevoked(certificate)

    if (revokedEntry) {
      return {
        isValid: false,
        isRevoked: true,
        error: new X509Error(
          `Certificate '${certificate.subject}' has been revoked. ` +
            `Revocation date: ${revokedEntry.revocationDate.toISOString()}` +
            (revokedEntry.reason !== undefined ? `, reason: ${revokedEntry.reason}` : '')
        ),
        details: `Revoked on ${revokedEntry.revocationDate.toISOString()}`,
        method: 'crl',
      }
    }

    // Certificate not found in CRL - it's valid
    return {
      isValid: true,
      isRevoked: false,
      details: `Certificate not found in CRL from ${result.usedUrl}`,
      method: 'crl',
    }
  }

  /**
   * Fetch and verify a CRL from a list of mirror URLs
   * Tries each URL in order until one succeeds
   */
  private static async fetchAndVerifyCrl(
    agentContext: AgentContext,
    urls: string[],
    issuerCertificate: X509Certificate,
    verificationDate: Date,
    options: X509RevocationCheckOptions
  ): Promise<
    { success: true; crl: X509CertificateRevocationList; usedUrl: string } | { success: false; error: string }
  > {
    let lastError: string | undefined

    // Try each URL (these are mirrors) until one succeeds
    for (const url of urls) {
      try {
        const crlData = await fetchCrl({
          url,
          timeoutMs: options.timeoutMs,
          maxSizeBytes: options.maxCrlSizeBytes,
          agentContext,
          cacheExpirySeconds: options.crlCacheExpirySeconds,
        })

        const crl = X509CertificateRevocationList.fromRaw(crlData)

        // Verify CRL signature with issuer's public key
        const verifyResult = await crl.verify(agentContext, issuerCertificate)
        if (!verifyResult.isValid) {
          lastError = `CRL signature verification failed for ${url}`
          continue
        }

        // Check if CRL is still valid (not expired)
        if (crl.isExpired(verificationDate)) {
          lastError = `CRL from ${url} has expired (nextUpdate: ${crl.nextUpdate?.toISOString() ?? 'unknown'})`
          continue
        }

        // Successfully fetched and verified CRL
        return { success: true, crl, usedUrl: url }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        // Continue to next URL
      }
    }

    // All URLs failed
    return {
      success: false,
      error: lastError ?? `All CRL URLs failed: ${urls.join(', ')}`,
    }
  }

  /**
   * Handles errors during revocation checking based on the configured mode
   */
  private static handleRevocationError(error: unknown, mode: X509RevocationCheckMode): X509RevocationCheckResult {
    const errorMessage = error instanceof Error ? error.message : String(error)

    switch (mode) {
      case X509RevocationCheckMode.SoftFail:
        // Allow validation to succeed despite revocation check failure
        // This means we weren't able to verify, if the check was successful but the certificate
        // is revoked it won't be returned as valid in SoftFail mode
        return {
          isValid: true,
          details: `Revocation check failed but SoftFail mode allowed: ${errorMessage}`,
        }

      case X509RevocationCheckMode.Require:
        // Fail the entire validation
        return {
          isValid: false,
          error: new X509Error(`Required revocation check failed: ${errorMessage}`, {
            cause: error instanceof Error ? error : undefined,
          }),
        }

      default:
        return {
          isValid: true,
          details: 'Revocation checking disabled',
        }
    }
  }
}
