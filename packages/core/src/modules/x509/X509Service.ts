import { AgentContext } from '../../agent'
import { CredoWebCrypto } from '../../crypto/webcrypto'
import { injectable } from '../../plugins'
import { CertificateSigningRequest } from './CertificateSigningRequest'
import { validateCriticalExtensionsForChain } from './utils/criticalExtensions'
import { X509Certificate, X509KeyUsage } from './X509Certificate'
import { X509CertificateCache } from './X509CertificateCache'
import { X509CertificateRevocationList } from './X509CertificateRevocationList'
import { X509Error, X509ValidationError } from './X509Error'
import { X509ModuleConfig } from './X509ModuleConfig'
import { X509RevocationService } from './X509RevocationService'
import type {
  EncodedX509Certificate,
  X509CreateCertificateOptions,
  X509CreateCertificateRevocationListOptions,
  X509CreateCertificateSigningRequestOptions,
  X509GetLeafCertificateOptions,
  X509ParseCertificateOptions,
  X509ParseCertificateSigningRequestOptions,
  X509ValidateCertificateChainOptions,
} from './X509ServiceOptions'
import { X509RevocationCheckMode } from './X509ValidationOptions'
import type { X509CertificateSingleValidationResult, X509ValidationResult } from './X509ValidationResult'

@injectable()
// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class X509Service {
  /**
   *
   * Validate a chain of X.509 certificates according to RFC 5280
   *
   * The leaf certificate should be the 0th index and the root the last
   *
   * Every certificate in the chain must be issued by the next one: the issuer name and, when present,
   * the AuthorityKeyIdentifier must match the next certificate, and its key must verify the signature.
   * The chain is then completed with trusted certificates in the same way.
   *
   * Validation checks performed:
   *   - Chain validation (structure, signatures, validity, trust anchor)
   *   - Basic constraints are valid for CA certificates
   *   - Key usage of issuing CA certificates includes `keyCertSign` (when the extension is present)
   *   - Path length constraints are satisfied
   *   - All critical extensions are understood and valid
   *   - Certificates have not been revoked (CRL) - if enabled
   *
   * Limitations (RFC 5280 features not enforced here):
   *   - Revocation is checked via CRL only; OCSP is not supported.
   *   - Name Constraints (§4.2.1.10), Policy Constraints (§4.2.1.11), and Certificate Policies
   *     (§4.2.1.4) are not enforced. A certificate carrying one of these as a *critical* extension is
   *     rejected (unrecognized critical extension); a non-critical occurrence is ignored.
   *   - Extended Key Usage is parsed but not enforced.
   *   - Key Usage is only enforced when the extension is present (it is optional; absent means
   *     unrestricted).
   *   - Subject/Issuer Alternative Names only surface the URI and DNS GeneralName forms.
   */
  public static async validateCertificateChain(
    agentContext: AgentContext,
    {
      certificateChain,
      verificationDate = new Date(),
      trustedCertificates,
      allowNonRootTrustedCertificate = true,
      parseOptions,
    }: X509ValidateCertificateChainOptions
  ) {
    const validations: X509ValidationResult['validations'] = {}
    const config = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const effectiveParseOptions = parseOptions ?? config.parseOptions

    let parsedChain: X509Certificate[]

    // Phase 1: Chain validation (structure + signatures + validity + trust)
    try {
      if (certificateChain.length === 0) {
        throw new X509Error('Certificate chain is empty')
      }
      const webCrypto = new CredoWebCrypto(agentContext)

      const toCertificate = (certificate: EncodedX509Certificate | Uint8Array | X509Certificate) =>
        X509CertificateCache.parseCertificate(agentContext, certificate, effectiveParseOptions)

      let providedChain: X509Certificate[]
      let parsedTrustedCertificates: X509Certificate[]
      try {
        providedChain = certificateChain.map(toCertificate)
        parsedTrustedCertificates = trustedCertificates.map(toCertificate)
      } catch (error) {
        throw new X509Error('Error during parsing of x509 certificate', { cause: error })
      }

      // Signatures: every certificate is signed by the next one, from the leaf up to a self-signed root
      // or to a certificate whose issuer is not known
      const { chain, endsInSelfSignedRoot } = await X509Service.buildCertificateChain(
        providedChain,
        parsedTrustedCertificates,
        verificationDate,
        webCrypto
      )

      // The chain is reversed here as the `x5c` header (the expected input),
      // has the leaf certificate as the first entry, while validation runs from the root down
      parsedChain = chain.reverse()

      // Trust: the chain must contain a trusted certificate
      const trustAnchorIndex = parsedChain.findIndex((cert) =>
        parsedTrustedCertificates.some((tCert) => cert.equal(tCert))
      )
      if (trustAnchorIndex === -1) {
        throw new X509Error('No trusted certificate was found while validating the X.509 chain')
      }

      // The chain starts at the trust anchor, the certificates above it are not relevant for validation
      parsedChain = parsedChain.slice(trustAnchorIndex)

      // Trust anchor: its own signature is verified when it is a self-signed root, or by the certificate above it.
      // Otherwise it is a directly trusted intermediate or leaf whose issuer is not known.
      //
      // Scenario: For ISO 18013-5 mDL, the root cert MUST NOT be in the chain. If the intermediate/signer
      // certificate is directly trusted, we can't verify its signature without the root certificate.
      // See also https://github.com/openid/OpenID4VCI/issues/62
      const isTrustAnchorSignatureVerified = endsInSelfSignedRoot || trustAnchorIndex > 0
      if (!isTrustAnchorSignatureVerified && !allowNonRootTrustedCertificate) {
        throw new X509Error(
          'Unable to verify the certificate chain. A trusted non-self-signed certificate is the first certificate in the chain, ' +
            'but no parent certificate was found to verify its signature. Either provide the parent certificate in trustedCertificates, ' +
            'or set allowNonRootTrustedCertificate to true to allow trusting intermediate certificates without signature verification.'
        )
      }

      // Dates: every certificate from the trust anchor down to the leaf is valid on the verification date
      for (const cert of parsedChain) {
        await cert.verify({ verificationDate, skipSignatureVerification: true }, webCrypto)
      }

      validations.chain = { isValid: true }
    } catch (error) {
      const x509Error = error instanceof X509Error ? error : new X509Error('Chain validation failed', { cause: error })
      validations.chain = { isValid: false, error: x509Error }
      throw new X509ValidationError(x509Error.message, { isValid: false, validations, error: x509Error })
    }

    // Phase 2: Basic constraints validation for CA certificates
    validations.basicConstraints = X509Service.validateBasicConstraintsForChain(parsedChain)
    if (!validations.basicConstraints.isValid) {
      throw new X509ValidationError(
        validations.basicConstraints.error?.message ?? 'Basic constraints validation failed',
        { isValid: false, validations, error: validations.basicConstraints.error }
      )
    }

    // Phase 2.5: Key usage validation for issuing CA certificates
    validations.keyUsage = X509Service.validateKeyUsageForChain(parsedChain)
    if (!validations.keyUsage.isValid) {
      throw new X509ValidationError(validations.keyUsage.error?.message ?? 'Key usage validation failed', {
        isValid: false,
        validations,
        error: validations.keyUsage.error,
      })
    }

    // Phase 3: Path length constraint validation
    validations.pathLength = X509Service.validatePathLengthConstraints(parsedChain)
    if (!validations.pathLength.isValid) {
      throw new X509ValidationError(
        validations.pathLength.error?.message ?? 'Path length constraint validation failed',
        { isValid: false, validations, error: validations.pathLength.error }
      )
    }

    // Phase 4: Critical extension validation
    validations.criticalExtensions = validateCriticalExtensionsForChain(parsedChain)
    if (!validations.criticalExtensions.isValid) {
      throw new X509ValidationError(
        validations.criticalExtensions.error?.message ?? 'Critical extension validation failed',
        { isValid: false, validations, error: validations.criticalExtensions.error }
      )
    }

    // Phase 5: Revocation checking (if enabled)
    if (config.revocationCheck.mode !== X509RevocationCheckMode.Disabled) {
      validations.revocationStatus = await X509RevocationService.checkCertificateChainRevocation(
        agentContext,
        parsedChain,
        config,
        verificationDate,
        effectiveParseOptions
      )
      if (!validations.revocationStatus.isValid) {
        throw new X509ValidationError(validations.revocationStatus.error?.message ?? 'Revocation check failed', {
          isValid: false,
          validations,
          error: validations.revocationStatus.error,
        })
      }
    } else {
      validations.revocationStatus = { isValid: true, details: 'Revocation checking disabled' }
    }

    return parsedChain
  }

  /**
   * Builds the chain from the leaf up and verifies every signature in it: first the presented certificates,
   * then trusted certificates until a self-signed root, or until no issuer is found. It does not decide
   * whether the chain is trusted.
   */
  private static async buildCertificateChain(
    presentedChain: X509Certificate[],
    trustedCertificates: X509Certificate[],
    verificationDate: Date,
    webCrypto: CredoWebCrypto
  ) {
    // The issuer name and key identifier of `certificate` point to `issuer`, and the key of `issuer` made its signature
    const isSignedBy = async (certificate: X509Certificate, issuer: X509Certificate) =>
      certificate.isPossiblyIssuedBy(issuer) &&
      (await certificate.verifySignature(issuer.publicJwk, webCrypto).catch(() => false))

    // Root: a certificate that is signed with its own key
    const isSelfSigned = (certificate: X509Certificate) => isSignedBy(certificate, certificate)

    const isValidOnVerificationDate = (certificate: X509Certificate) =>
      certificate.verify({ verificationDate, skipSignatureVerification: true }, webCrypto).then(
        () => true,
        () => false
      )

    // A valid issuer wins over the first match, so an expired trusted certificate does not hide
    // its renewal with the same name and key
    const findTrustedIssuer = async (certificate: X509Certificate) => {
      let firstIssuer: X509Certificate | undefined
      for (const trustedCertificate of trustedCertificates) {
        if (!(await isSignedBy(certificate, trustedCertificate))) continue
        if (await isValidOnVerificationDate(trustedCertificate)) return trustedCertificate

        firstIssuer ??= trustedCertificate
      }
      return firstIssuer
    }

    // Leaf: the first presented certificate
    const chain = [presentedChain[0]]
    const addIssuer = (issuer: X509Certificate) => {
      if (chain.some((chainCertificate) => chainCertificate.equal(issuer))) {
        throw new X509Error('Cannot build a certificate chain. Circular dependency.')
      }
      chain.push(issuer)
    }

    // Presented certificates: each one must have signed the certificate before it
    for (const issuer of presentedChain.slice(1)) {
      const certificate = chain[chain.length - 1]
      if (!(await isSignedBy(certificate, issuer))) {
        throw new X509Error(
          `Certificate: '${certificate.subject}' is not issued by the next certificate in the chain: '${issuer.subject}'`
        )
      }
      addIssuer(issuer)
    }

    // Trusted certificates: complete the chain until a self-signed root
    while (true) {
      const lastCertificate = chain[chain.length - 1]
      if (await isSelfSigned(lastCertificate)) return { chain, endsInSelfSignedRoot: true }

      const trustedIssuer = await findTrustedIssuer(lastCertificate)
      // No issuer is known, so the signature on the last certificate is not verified
      if (!trustedIssuer) return { chain, endsInSelfSignedRoot: false }

      addIssuer(trustedIssuer)
    }
  }

  /**
   *
   * Parses a base64/PEM-encoded or DER X.509 certificate into a {@link X509Certificate}
   *
   */
  public static parseCertificate(
    agentContext: AgentContext,
    { encodedCertificate, parseOptions }: X509ParseCertificateOptions
  ): X509Certificate {
    return X509CertificateCache.parseCertificate(agentContext, encodedCertificate, parseOptions)
  }

  public static getLeafCertificate(
    agentContext: AgentContext,
    { certificateChain, parseOptions }: X509GetLeafCertificateOptions
  ): X509Certificate {
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    return X509Service.parseCertificate(agentContext, { encodedCertificate: certificateChain[0], parseOptions })
  }

  public static async createCertificate(agentContext: AgentContext, options: X509CreateCertificateOptions) {
    const webCrypto = new CredoWebCrypto(agentContext)

    const certificate = await X509Certificate.create(options, webCrypto)

    return certificate
  }

  public static async createCertificateSigningRequest(
    agentContext: AgentContext,
    options: X509CreateCertificateSigningRequestOptions
  ) {
    const webCrypto = new CredoWebCrypto(agentContext)

    const csr = await CertificateSigningRequest.create(options, webCrypto)

    return csr
  }

  /**
   * Creates and signs a X.509 Certificate Revocation List (CRL).
   *
   * Supported CRL extensions: CRL Number (§5.2.3), Delta CRL Indicator (§5.2.4), Authority Key
   * Identifier (§5.2.1) and Issuing Distribution Point (§5.2.5), plus the per-entry
   * `certificateIssuer` extension (§5.3.3) for indirect CRLs. Other CRL extensions are not produced.
   *
   * Note: issuer/subject names built from a structured object only support the `CN`, `C`, `OU` and
   * `ST` distinguished-name attributes; pass a raw DN string to use any other attribute.
   */
  public static async createCertificateRevocationList(
    agentContext: AgentContext,
    options: X509CreateCertificateRevocationListOptions
  ) {
    const webCrypto = new CredoWebCrypto(agentContext)

    const crl = await X509CertificateRevocationList.create(options, webCrypto)

    return crl
  }

  public static parseCertificateSigningRequest(
    agentContext: AgentContext,
    { encodedCertificateSigningRequest, parseOptions }: X509ParseCertificateSigningRequestOptions
  ) {
    const config = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const csr = CertificateSigningRequest.fromEncodedCertificateRequest(
      encodedCertificateSigningRequest,
      parseOptions ?? config.parseOptions
    )

    return csr
  }

  /**
   * Validates path length constraints for a certificate chain
   * Per RFC 5280 Section 4.2.1.9
   */
  private static validatePathLengthConstraints(
    certificateChain: X509Certificate[]
  ): X509CertificateSingleValidationResult {
    let currentPathLength = 0

    // The chain is ordered root-first (index 0) to leaf (last index). Iterate from the leaf upward,
    // counting the intermediate CAs encountered so each CA's pathLenConstraint can be checked against
    // the number of CAs that follow it toward the leaf.
    for (let i = certificateChain.length - 1; i >= 0; i--) {
      const cert = certificateChain[i]
      const basicConstraints = cert.basicConstraints

      // Certificates without basicConstraints are not a CA
      if (!basicConstraints) continue

      // Skip leaf certificates (not CA)
      if (!basicConstraints.ca) {
        continue
      }

      // Check if pathLength constraint is violated
      if (basicConstraints.pathLength !== undefined) {
        const remainingCAsInChain = currentPathLength
        if (remainingCAsInChain > basicConstraints.pathLength) {
          return {
            isValid: false,
            error: new X509Error(
              `Path length constraint violated. Certificate '${cert.subject}' has pathLength=${basicConstraints.pathLength} ` +
                `but ${remainingCAsInChain} intermediate CA(s) follow it in the chain.`
            ),
            details: `pathLength=${basicConstraints.pathLength}, actual=${remainingCAsInChain}`,
          }
        }
      }

      currentPathLength++
    }

    return { isValid: true }
  }

  /**
   * Validates basic constraints for CA certificates in the chain
   * Per RFC 5280 Section 4.2.1.9
   */
  private static validateBasicConstraintsForChain(
    certificateChain: X509Certificate[]
  ): X509CertificateSingleValidationResult {
    // Check all certificates except the last one (which is typically the end-entity/leaf)
    // In a properly ordered chain, CA certificates will be before the leaf
    for (let i = 0; i < certificateChain.length - 1; i++) {
      const cert = certificateChain[i]
      const basicConstraints = cert.basicConstraints

      if (!basicConstraints) {
        return {
          isValid: false,
          error: new X509Error(
            `Certificate '${cert.subject}' is used as a CA but does not have a basicConstraints extension`
          ),
        }
      }

      // Intermediate and root CAs MUST have ca=true
      if (!basicConstraints.ca) {
        return {
          isValid: false,
          error: new X509Error(
            `Certificate '${cert.subject}' is used as a CA but does not have basicConstraints with ca=true`
          ),
        }
      }
    }

    return { isValid: true }
  }

  /**
   * Validates the Key Usage extension of the issuing CA certificates in the chain.
   * Per RFC 5280 §4.2.1.3 / §6.1.4(n): a certificate used to sign other certificates MUST, when it
   * asserts a Key Usage extension, include the `keyCertSign` bit.
   *
   * Key Usage is optional in a certificate; when the extension is absent, all usages are permitted
   * and no constraint is enforced. Only the issuing certificates (every certificate except the leaf)
   * are checked.
   */
  private static validateKeyUsageForChain(certificateChain: X509Certificate[]): X509CertificateSingleValidationResult {
    // Every certificate except the last one (the leaf/end-entity) issues the next certificate in the
    // chain, mirroring the set checked by validateBasicConstraintsForChain.
    for (let i = 0; i < certificateChain.length - 1; i++) {
      const cert = certificateChain[i]
      const keyUsage = cert.keyUsage

      // An empty result means no Key Usage extension is present, so the key is unrestricted and there
      // is nothing to enforce (a well-formed Key Usage extension always asserts at least one bit).
      if (keyUsage && keyUsage.length > 0 && !keyUsage.includes(X509KeyUsage.KeyCertSign)) {
        return {
          isValid: false,
          error: new X509Error(
            `Certificate '${cert.subject}' is used as a CA but its key usage does not include keyCertSign`
          ),
          details: 'Missing keyCertSign key usage',
        }
      }
    }

    return { isValid: true }
  }
}
