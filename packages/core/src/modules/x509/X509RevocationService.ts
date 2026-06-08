import type { AgentContext } from '../../agent'
import { CredoWebCrypto } from '../../crypto/webcrypto'
import { injectable } from '../../plugins'
import { fetchCrl, getCachedCrl, setCachedCrl } from './utils/crlFetcher'
import { X509Certificate } from './X509Certificate'
import { type RevokedCertificate, X509CertificateRevocationList } from './X509CertificateRevocationList'
import { ALL_REVOCATION_REASONS_MASK, X509RevocationReason } from './X509CrlDistributionPoint'
import { X509CrlUnavailableError, X509Error } from './X509Error'
import { X509ModuleConfig } from './X509ModuleConfig'
import type {
  X509CheckCertificateRevocationOptions,
  X509FetchCertificateRevocationListOptions,
  X509ParseCertificateRevocationListOptions,
} from './X509ServiceOptions'
import { X509RevocationCheckMode, type X509RevocationCheckOptions } from './X509ValidationOptions'
import type { X509CertificateSingleValidationResult } from './X509ValidationResult'

export interface X509RevocationCheckResult {
  isValid: boolean
  isRevoked?: boolean
  error?: Error
  details?: string
  method?: 'crl'
}

/**
 * Default maximum cache TTL for a verified CRL (1 hour). The actual TTL is capped by the CRL's
 * `nextUpdate`.
 */
const DEFAULT_CRL_CACHE_EXPIRY_SECONDS = 3600

@injectable()
// biome-ignore lint/complexity/noStaticOnlyClass: Service class pattern used in Credo
export class X509RevocationService {
  /**
   * Check the revocation status of a single certificate using CRL.
   */
  public static async checkCertificateRevocation(
    agentContext: AgentContext,
    { certificate, issuerCertificate, revocationCheckOptions }: X509CheckCertificateRevocationOptions
  ): Promise<X509RevocationCheckResult> {
    const parsedCertificate =
      certificate instanceof X509Certificate ? certificate : X509Certificate.fromEncodedCertificate(certificate)
    const parsedIssuerCertificate =
      issuerCertificate instanceof X509Certificate
        ? issuerCertificate
        : X509Certificate.fromEncodedCertificate(issuerCertificate)

    const options = revocationCheckOptions ??
      agentContext.dependencyManager.resolve(X509ModuleConfig).revocationCheck ?? {
        mode: X509RevocationCheckMode.SoftFail,
      }

    const mode = options.mode ?? X509RevocationCheckMode.SoftFail
    if (mode === X509RevocationCheckMode.Disabled) {
      return { isValid: true, details: 'Revocation checking disabled' }
    }

    try {
      return await X509RevocationService.checkCrl(agentContext, parsedCertificate, parsedIssuerCertificate, options)
    } catch (error) {
      return X509RevocationService.handleRevocationError(error, mode)
    }
  }

  /**
   * Check the revocation status of every certificate in a chain (the leaf and, unless
   * `checkFullChain` is disabled, the intermediate CAs). The root is skipped as it is self-issued and
   * not covered by a CRL we can fetch and verify.
   *
   * The chain must be ordered from root (index 0) to leaf (last index); each certificate's issuer is
   * the certificate that precedes it in the chain.
   */
  public static async checkCertificateChainRevocation(
    agentContext: AgentContext,
    certificateChain: X509Certificate[],
    config: X509ModuleConfig,
    verificationDate: Date
  ): Promise<X509CertificateSingleValidationResult> {
    const configuredRevocationCheck = config.revocationCheck
    if (!configuredRevocationCheck || configuredRevocationCheck.mode === X509RevocationCheckMode.Disabled) {
      return { isValid: true, details: 'Revocation checking disabled' }
    }

    // Use the chain's verificationDate for CRL validity (thisUpdate/nextUpdate) checks
    // unless the revocation config explicitly overrides it.
    const revocationConfig: X509RevocationCheckOptions = {
      ...configuredRevocationCheck,
      verificationDate: configuredRevocationCheck.verificationDate ?? verificationDate,
    }

    // The chain is ordered from root (index 0) to leaf (last index). A certificate's issuer is the
    // certificate that precedes it in the chain. The root certificate (index 0) is skipped.
    const checkFullChain = revocationConfig.checkFullChain ?? true
    const startIndex = checkFullChain ? 1 : certificateChain.length - 1

    for (let i = startIndex; i < certificateChain.length; i++) {
      const certificate = certificateChain[i]
      // The issuer is the preceding certificate in the chain.
      const issuerCertificate = certificateChain[i - 1]

      if (!issuerCertificate) {
        // No issuer available (e.g. a single self-signed certificate); nothing to check.
        continue
      }

      const result = await X509RevocationService.checkCertificateRevocation(agentContext, {
        certificate,
        issuerCertificate,
        revocationCheckOptions: revocationConfig,
      })

      if (!result.isValid) {
        return {
          isValid: false,
          error: result.error,
          details: result.details,
        }
      }
    }

    return { isValid: true, details: 'No certificates are revoked' }
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

    // Step 1: Check if there's a "full" distribution point (no reasons specified). Indirect CRLs
    // (those with a crlIssuer) are excluded here - we can't verify them, so they fall through to the
    // partitioned path below where they are tracked as an unsupported feature instead of being
    // fetched and failing verification against the wrong issuer.
    const fullDistributionPoint = distributionPoints.find(
      (dp) => dp.reasons === undefined && dp.crlIssuer === undefined
    )

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
    const coveredCrls: X509CertificateRevocationList[] = []
    const fetchedDPs: string[] = []
    const fetchErrors: string[] = [] // Track errors for DPs we couldn't fetch
    const unsupportedDPs: Array<{ reasons: number; feature: string }> = [] // Track DPs we can't process

    // Whether any DP downloaded a CRL that then failed verification/validity
    let integrityFailure = false

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

        // A downloaded-but-rejected CRL is an integrity failure
        if (result.reachable) integrityFailure = true

        continue
      }

      // Successfully fetched CRL - mark these reasons as covered
      coveredReasons |= dpReasonMask
      fetchedDPs.push(result.usedUrl)

      // Keep the verified CRL so we can look up the certificate using the same
      // (format-normalizing) matching logic as the single distribution point path.
      coveredCrls.push(result.crl)

      // Check if we've covered all required reasons
      if ((coveredReasons & requiredReasonsMask) === requiredReasonsMask) {
        break
      }
    }

    // Step 3: Check if the certificate is revoked in any CRL we DID collect. Presence on a scoped
    // CRL is a definitive revocation regardless of whether every required reason partition was
    // obtained, so this must be checked BEFORE concluding anything about coverage completeness -
    // otherwise an unreachable partition could mask a revocation we already have proof of.
    // Use the CRL's own findRevoked so serial number formats are normalized consistently with the
    // single distribution point path.
    let revokedEntry: RevokedCertificate | null = null
    for (const crl of coveredCrls) {
      revokedEntry = crl.findRevoked(certificate)
      if (revokedEntry) break
    }

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

    // Step 4: The certificate was not found revoked. We can only conclude it is NOT revoked if we
    // actually covered all required revocation reasons; otherwise the status is indeterminate.
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
      let unsupportedCoversMissing = false
      for (const unsupported of unsupportedDPs) {
        if (unsupported.reasons & missingReasons) {
          unsupportedCoversMissing = true
          const unsupportedReasons = X509RevocationService.reasonMaskToNames(unsupported.reasons & missingReasons)
          errorMsg += ` Unsupported CRL feature ${unsupported.feature} covers missing reasons: [${unsupportedReasons.join(', ')}].`
        }
      }

      if (fetchErrors.length > 0) {
        errorMsg += ` Fetch errors: ${fetchErrors.join('; ')}`
      }

      // Check if the missing reasons are covered by any DP (even if we couldn't fetch its CRL):
      // if not, it's a structural gap that can't be soft-failed.
      const reasonsPublishedByAnyDp = X509RevocationService.calculateAllReasonsInDPs(distributionPoints)
      const structuralGap = (missingReasons & ~reasonsPublishedByAnyDp) !== 0

      // The coverage gap is soft-failable only when it is purely caused by CRLs we could not reach;
      // an integrity failure, an unsupported feature, or a structural gap is never soft-failed.
      const availabilityOnly = !integrityFailure && !unsupportedCoversMissing && !structuralGap

      throw availabilityOnly ? new X509CrlUnavailableError(errorMsg) : new X509Error(errorMsg)
    }

    // Certificate not found in any CRL and all required reasons covered - it's valid
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
      const message =
        `Failed to fetch CRL from distribution point (URLs: ${distributionPoint.urls.join(', ')}). ` +
        `Error: ${result.error}`

      throw result.reachable ? new X509Error(message) : new X509CrlUnavailableError(message)
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
    | { success: true; crl: X509CertificateRevocationList; usedUrl: string }
    | { success: false; error: string; reachable: boolean }
  > {
    let lastError: string | undefined

    // Whether at least one URL produced a downloaded CRL
    let reachable = false

    const webCrypto = new CredoWebCrypto(agentContext)

    // Try each URL (these are mirrors) until one succeeds
    for (const url of urls) {
      const result = await X509RevocationService.fetchVerifyAndCacheCrl(
        agentContext,
        { url, issuerCertificate, verificationDate, options, useCache: true },
        webCrypto
      )

      if (result.success) return { success: true, crl: result.crl, usedUrl: url }

      lastError = result.error
      if (result.reachable) reachable = true
    }

    // All URLs failed
    return {
      success: false,
      error: lastError ?? `All CRL URLs failed: ${urls.join(', ')}`,
      reachable,
    }
  }

  /**
   * Download a single CRL (optionally from the cache), parse it, and verify it against the issuer.
   */
  private static async fetchVerifyAndCacheCrl(
    agentContext: AgentContext,
    {
      url,
      issuerCertificate,
      verificationDate,
      options,
      useCache,
    }: {
      url: string
      issuerCertificate: X509Certificate
      verificationDate: Date
      options: { timeoutMs?: number; maxCrlSizeBytes?: number; crlCacheExpirySeconds?: number }
      useCache: boolean
    },
    webCrypto: CredoWebCrypto
  ): Promise<
    { success: true; crl: X509CertificateRevocationList } | { success: false; error: string; reachable: boolean }
  > {
    // Whether we obtained the CRL bytes (from cache or a successful download).
    let reachable = false

    try {
      // Use a cached (previously verified) CRL if available, otherwise fetch it.
      const cachedData = useCache ? await getCachedCrl(agentContext, url) : null
      const crlData =
        cachedData ??
        (await fetchCrl({ url, timeoutMs: options.timeoutMs, maxSizeBytes: options.maxCrlSizeBytes, agentContext }))

      reachable = true

      const crl = X509CertificateRevocationList.fromRaw(crlData)

      // Verify the CRL signature, issuer-name binding, and validity window against the issuer.
      const verifyResult = await crl.verify({ issuerCertificate, verificationDate }, webCrypto)
      if (!verifyResult.isValid) {
        return { success: false, error: verifyResult.error?.message ?? 'CRL verification failed', reachable }
      }

      // Cache only freshly-fetched, fully-verified CRLs, with a TTL bounded by nextUpdate so an
      // expired CRL is never served from the cache.
      if (useCache && !cachedData) {
        const ttlSeconds = X509RevocationService.computeCacheTtlSeconds(
          crl,
          verificationDate,
          options.crlCacheExpirySeconds
        )
        await setCachedCrl(agentContext, url, crlData, ttlSeconds)
      }

      return { success: true, crl }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), reachable }
    }
  }

  /**
   * Compute the cache TTL (in seconds) for a verified CRL: the time until its `nextUpdate`, capped
   * at `maxSeconds` (default 1 hour). Returns 0 when the CRL is already at/after `nextUpdate` so it
   * is not cached.
   */
  private static computeCacheTtlSeconds(
    crl: X509CertificateRevocationList,
    verificationDate: Date,
    maxSeconds = DEFAULT_CRL_CACHE_EXPIRY_SECONDS
  ): number {
    if (!crl.nextUpdate) return maxSeconds

    const secondsUntilNextUpdate = Math.floor((crl.nextUpdate.getTime() - verificationDate.getTime()) / 1000)
    return Math.max(0, Math.min(maxSeconds, secondsUntilNextUpdate))
  }

  /**
   * Handles errors during revocation checking based on the configured mode
   */
  private static handleRevocationError(error: unknown, mode: X509RevocationCheckMode): X509RevocationCheckResult {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (mode === X509RevocationCheckMode.Disabled) {
      return {
        isValid: true,
        details: 'Revocation checking disabled',
      }
    }

    // SoftFail only tolerates an availability failure (the CRL could not be obtained)
    if (mode === X509RevocationCheckMode.SoftFail && error instanceof X509CrlUnavailableError) {
      return {
        isValid: true,
        details: `CRL could not be obtained but SoftFail mode allowed it: ${errorMessage}`,
      }
    }

    // Remaining cases result in validation failure
    return {
      isValid: false,
      error: new X509Error(`Required revocation check failed: ${errorMessage}`, {
        cause: error instanceof Error ? error : undefined,
      }),
    }
  }

  /**
   * Fetch a CRL from a URL and parse it into an {@link X509CertificateRevocationList}.
   *
   * When `issuerCertificate` is provided, the CRL's signature, issuer name, and validity window are
   * verified, and an error is thrown on failure. When omitted, the CRL is returned unverified.
   */
  public static async fetchCertificateRevocationList(
    agentContext: AgentContext,
    {
      url,
      issuerCertificate,
      timeoutMs,
      maxCrlSizeBytes,
      verificationDate = new Date(),
    }: X509FetchCertificateRevocationListOptions
  ): Promise<X509CertificateRevocationList> {
    // Without an issuer certificate we cannot verify the CRL; just fetch and parse it.
    if (!issuerCertificate) {
      const crlData = await fetchCrl({ url, timeoutMs, maxSizeBytes: maxCrlSizeBytes, agentContext })
      return X509CertificateRevocationList.fromRaw(crlData)
    }

    const parsedIssuerCertificate =
      issuerCertificate instanceof X509Certificate
        ? issuerCertificate
        : X509Certificate.fromEncodedCertificate(issuerCertificate)

    const result = await X509RevocationService.fetchVerifyAndCacheCrl(
      agentContext,
      {
        url,
        issuerCertificate: parsedIssuerCertificate,
        verificationDate,
        options: { timeoutMs, maxCrlSizeBytes },
        // This is an explicit, one-off fetch; don't read from or populate the revocation cache.
        useCache: false,
      },
      new CredoWebCrypto(agentContext)
    )

    if (!result.success) {
      // Distinguish an availability failure (could not download) from an integrity failure
      // (downloaded but rejected), mirroring the revocation engine's classification.
      throw result.reachable
        ? new X509Error(`CRL from ${url} could not be verified: ${result.error}`)
        : new X509CrlUnavailableError(result.error)
    }

    return result.crl
  }

  /**
   * Parse a base64- or PEM-encoded CRL into an {@link X509CertificateRevocationList}.
   */
  public static parseCertificateRevocationList({
    encodedCertificateRevocationList,
  }: X509ParseCertificateRevocationListOptions): X509CertificateRevocationList {
    return X509CertificateRevocationList.fromEncoded(encodedCertificateRevocationList)
  }
}
