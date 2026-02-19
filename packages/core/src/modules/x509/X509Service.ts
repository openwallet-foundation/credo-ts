import * as x509 from '@peculiar/x509'
import { injectable } from 'tsyringe'
import { AgentContext } from '../../agent'
import { CredoWebCrypto } from '../../crypto/webcrypto'
import { CertificateSigningRequest } from './CertificateSigningRequest'
import { X509ExtensionIdentifier } from './utils'
import { validateCriticalExtensionsForChain } from './utils/criticalExtensions'
import { X509Certificate } from './X509Certificate'
import { X509Error, X509ValidationError } from './X509Error'
import { X509ModuleConfig } from './X509ModuleConfig'
import { X509RevocationService } from './X509RevocationService'
import type {
  X509CreateCertificateOptions,
  X509CreateCertificateSigningRequestOptions,
  X509GetLeafCertificateOptions,
  X509ParseCertificateOptions,
  X509ParseCertificateSigningRequestOptions,
  X509ValidateCertificateChainOptions,
} from './X509ServiceOptions'
import { X509RevocationCheckMode } from './X509ValidationOptions'
import type { SingleValidationResult, X509ValidationResult } from './X509ValidationResult'

@injectable()
// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class X509Service {
  /**
   *
   * Validate a chain of X.509 certificates according to RFC 5280
   *
   * This function requires a list of base64 encoded certificates and, optionally, a certificate that should be found in the chain.
   * If no certificate is provided, it will just assume the leaf certificate
   *
   * The leaf certificate should be the 0th index and the root the last
   *
   * The Issuer of the certificate is found with the following algorithm:
   * - Check if there is an AuthorityKeyIdentifierExtension
   * - Go through all the other certificates and see if the SubjectKeyIdentifier is equal to the AuthorityKeyIdentifier
   * - If they are equal, the certificate signature is verified and returned as the issuer
   *
   * Validation checks performed:
   *   - Chain validation (structure, signatures, validity, trust anchor)
   *   - Basic constraints are valid for CA certificates
   *   - Path length constraints are satisfied
   *   - All critical extensions are understood and valid
   *   - Certificates have not been revoked (CRL) - if enabled
   */
  public static async validateCertificateChain(
    agentContext: AgentContext,
    {
      certificateChain,
      certificate = certificateChain[0],
      verificationDate = new Date(),
      trustedCertificates,
      allowNonRootTrustedCertificate = true,
    }: X509ValidateCertificateChainOptions
  ) {
    const validations: X509ValidationResult['validations'] = {}
    const config = agentContext.dependencyManager.resolve(X509ModuleConfig)

    let parsedChain: X509Certificate[]

    // Phase 1: Chain validation (structure + signatures + validity + trust)
    try {
      if (certificateChain.length === 0) {
        throw new X509Error('Certificate chain is empty')
      }
      const webCrypto = new CredoWebCrypto(agentContext)

      let parsedLeafCertificate: x509.X509Certificate
      let certificatesToBuildChain: x509.X509Certificate[]
      try {
        parsedLeafCertificate = new x509.X509Certificate(certificate)
        certificatesToBuildChain = [...certificateChain, ...(trustedCertificates ?? [])].map(
          (c) => new x509.X509Certificate(c)
        )
      } catch (error) {
        throw new X509Error('Error during parsing of x509 certificate', { cause: error })
      }

      const certificateChainBuilder = new x509.X509ChainBuilder({
        certificates: certificatesToBuildChain,
      })

      const chain = await certificateChainBuilder.build(parsedLeafCertificate, webCrypto)

      // The chain is reversed here as the `x5c` header (the expected input),
      // has the leaf certificate as the first entry, while the `x509` library expects this as the last
      parsedChain = chain.map((c) => X509Certificate.fromRawCertificate(new Uint8Array(c.rawData))).reverse()

      // We allow longer parsed chain, in case the root cert was not part of the chain, but in the
      // list of trusted certificates
      if (parsedChain.length < certificateChain.length) {
        throw new X509Error('Could not parse the full chain. Likely due to incorrect ordering')
      }

      let previousCertificate: X509Certificate | undefined

      if (trustedCertificates) {
        const parsedTrustedCertificates = trustedCertificates.map((trustedCertificate) =>
          X509Certificate.fromEncodedCertificate(trustedCertificate)
        )

        const trustedCertificateIndex = parsedChain.findIndex((cert) =>
          parsedTrustedCertificates.some((tCert) => cert.equal(tCert))
        )

        if (trustedCertificateIndex === -1) {
          throw new X509Error('No trusted certificate was found while validating the X.509 chain')
        }

        if (trustedCertificateIndex > 0) {
          // When we trust a certificate other than the first certificate in the provided chain we keep a reference to the
          // previous certificate as we need the key of this certificate to verify the first certificate in the chain as
          // it's not self-signed.
          previousCertificate = parsedChain[trustedCertificateIndex - 1]

          // Pop everything off before the index of the trusted certificate (those are more root) as it is not relevant for validation
          parsedChain = parsedChain.slice(trustedCertificateIndex)
        }
      }

      // Verify signatures and validity for all certificates in the chain
      for (let i = 0; i < parsedChain.length; i++) {
        const cert = parsedChain[i]
        const publicJwk = previousCertificate ? previousCertificate.publicJwk : undefined

        // When a trusted certificate is the first in the chain and we don't have its parent certificate's public key,
        // we may need to skip signature verification based on configuration.
        //
        // Scenario: For ISO 18013-5 mDL, the root cert MUST NOT be in the chain. If the intermediate/signer
        // certificate is directly trusted, we can't verify its signature without the root certificate.
        // See also https://github.com/openid/OpenID4VCI/issues/62
        //
        // If allowNonRootTrustedCertificate is false, we require the signature to be verifiable.
        const skipSignatureVerification = i === 0 && trustedCertificates && !publicJwk && allowNonRootTrustedCertificate

        // If we don't allow non-root trusted certificates and can't verify the signature, throw an error
        if (i === 0 && trustedCertificates && !publicJwk && !allowNonRootTrustedCertificate) {
          throw new X509Error(
            'Unable to verify the certificate chain. A trusted non-self-signed certificate is the first certificate in the chain, ' +
              'but no parent certificate was found to verify its signature. Either provide the parent certificate in trustedCertificates, ' +
              'or set allowNonRootTrustedCertificate to true to allow trusting intermediate certificates without signature verification.'
          )
        }

        await cert.verify(
          {
            publicJwk,
            verificationDate,
            skipSignatureVerification,
          },
          webCrypto
        )
        previousCertificate = cert
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

    // Phase 3: Path length constraint validation
    validations.pathLength = X509Service.validatePathLengthConstraints(parsedChain)
    if (!validations.pathLength.isValid) {
      throw new X509ValidationError(
        validations.pathLength.error?.message ?? 'Path length constraint validation failed',
        { isValid: false, validations, error: validations.pathLength.error }
      )
    }

    // Phase 4: Critical extension validation
    const peculiarChain = parsedChain.map((cert) => new x509.X509Certificate(cert.rawCertificate))
    validations.criticalExtensions = validateCriticalExtensionsForChain(peculiarChain)
    if (!validations.criticalExtensions.isValid) {
      throw new X509ValidationError(
        validations.criticalExtensions.error?.message ?? 'Critical extension validation failed',
        { isValid: false, validations, error: validations.criticalExtensions.error }
      )
    }

    // Phase 5: Revocation checking (if enabled)
    if (config.revocationCheck && config.revocationCheck.mode !== X509RevocationCheckMode.Disabled) {
      validations.revocationStatus = await X509Service.checkRevocationForChain(agentContext, parsedChain, config)
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
   *
   * Parses a base64-encoded X.509 certificate into a {@link X509Certificate}
   *
   */
  public static parseCertificate(
    _agentContext: AgentContext,
    { encodedCertificate }: X509ParseCertificateOptions
  ): X509Certificate {
    const certificate = X509Certificate.fromEncodedCertificate(encodedCertificate)

    return certificate
  }

  public static getLeafCertificate(
    _agentContext: AgentContext,
    { certificateChain }: X509GetLeafCertificateOptions
  ): X509Certificate {
    if (certificateChain.length === 0) throw new X509Error('Certificate chain is empty')

    const certificate = X509Certificate.fromEncodedCertificate(certificateChain[0])

    return certificate
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

  public static parseCertificateSigningRequest({
    encodedCertificateSigningRequest,
  }: X509ParseCertificateSigningRequestOptions) {
    const csr = CertificateSigningRequest.fromEncodedCertificateRequest(encodedCertificateSigningRequest)

    return csr
  }

  /**
   * Validates path length constraints for a certificate chain
   * Per RFC 5280 Section 4.2.1.9
   */
  private static validatePathLengthConstraints(certificateChain: X509Certificate[]): SingleValidationResult {
    let currentPathLength = 0

    // Iterate from trust anchor (end) to leaf (start)
    for (let i = certificateChain.length - 1; i >= 0; i--) {
      const cert = certificateChain[i]
      const peculiarCert = new x509.X509Certificate(cert.rawCertificate)
      const basicConstraintsExt = peculiarCert.getExtension(X509ExtensionIdentifier.BasicConstraints)

      if (!basicConstraintsExt) {
        // Leaf certificates don't need basicConstraints
        if (i === 0) continue
        // But CA certificates should have it
        continue
      }

      const basicConstraints = new x509.BasicConstraintsExtension(basicConstraintsExt.rawData)

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
  private static validateBasicConstraintsForChain(certificateChain: X509Certificate[]): SingleValidationResult {
    // Check all certificates except the last one (which is typically the end-entity/leaf)
    // In a properly ordered chain, CA certificates will be before the leaf
    for (let i = 0; i < certificateChain.length - 1; i++) {
      const cert = certificateChain[i]
      const peculiarCert = new x509.X509Certificate(cert.rawCertificate)
      const basicConstraintsExt = peculiarCert.getExtension('2.5.29.19')

      if (!basicConstraintsExt) {
        return {
          isValid: false,
          error: new X509Error(
            `Certificate '${cert.subject}' is used as a CA but does not have a basicConstraints extension`
          ),
        }
      }

      const basicConstraints = new x509.BasicConstraintsExtension(basicConstraintsExt.rawData)

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
   * Checks revocation status for certificates in the chain
   */
  private static async checkRevocationForChain(
    agentContext: AgentContext,
    certificateChain: X509Certificate[],
    config: X509ModuleConfig
  ): Promise<SingleValidationResult> {
    const revocationConfig = config.revocationCheck
    if (!revocationConfig || revocationConfig.mode === X509RevocationCheckMode.Disabled) {
      return { isValid: true, details: 'Revocation checking disabled' }
    }

    const checkFullChain = revocationConfig.checkFullChain ?? false
    const certificatesToCheck = checkFullChain
      ? certificateChain.slice(0, -1) // Check all except root
      : [certificateChain[0]] // Only check leaf

    for (let i = 0; i < certificatesToCheck.length; i++) {
      const certificate = certificatesToCheck[i]
      // Get the issuer certificate (next in chain)
      const issuerCertificate = certificateChain[i + 1]

      if (!issuerCertificate) {
        // This shouldn't happen if the chain is valid, but handle it gracefully
        continue
      }

      const result = await X509RevocationService.checkRevocation(
        agentContext,
        certificate,
        issuerCertificate,
        revocationConfig
      )

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
}
