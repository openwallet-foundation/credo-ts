import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'

import { X509ModuleConfig } from './X509ModuleConfig'
import { X509RevocationService } from './X509RevocationService'
import { X509Service } from './X509Service'
import type {
  X509CheckCertificateRevocationOptions,
  X509CreateCertificateOptions,
  X509CreateCertificateSigningRequestOptions,
  X509FetchCertificateRevocationListOptions,
  X509ParseCertificateRevocationListOptions,
  X509ParseCertificateSigningRequestOptions,
  X509ValidateCertificateChainOptions,
} from './X509ServiceOptions'

/**
 * @public
 */
@injectable()
export class X509Api {
  public constructor(
    private agentContext: AgentContext,
    public config: X509ModuleConfig
  ) {}

  /**
   * Creates a X.509 certificate.
   *
   * @param options X509CreateCertificateOptions
   */
  public async createCertificate(options: X509CreateCertificateOptions) {
    return await X509Service.createCertificate(this.agentContext, options)
  }

  /**
   * Create a certificate signing request (CSR)
   *
   * @param options X509CreateCertificateSigningRequestOptions
   */
  public async createCertificateSigningRequest(options: X509CreateCertificateSigningRequestOptions) {
    return await X509Service.createCertificateSigningRequest(this.agentContext, options)
  }

  /**
   * Parses a certificate signing request (CSR)
   *
   * @param options X509ParseCertificateSigningRequestOptions
   */
  public parseCertificateSigningRequest(options: X509ParseCertificateSigningRequestOptions) {
    return X509Service.parseCertificateSigningRequest(options)
  }

  /**
   * Validate a certificate chain.
   *
   * @param options X509ValidateCertificateChainOptions
   */
  public async validateCertificateChain(options: X509ValidateCertificateChainOptions) {
    return await X509Service.validateCertificateChain(this.agentContext, options)
  }

  /**
   * Check the revocation status of a single certificate using CRL.
   *
   * @param options X509CheckCertificateRevocationOptions
   */
  public async checkCertificateRevocation(options: X509CheckCertificateRevocationOptions) {
    return await X509RevocationService.checkCertificateRevocation(this.agentContext, options)
  }

  /**
   * Fetch a CRL from a URL and parse it, optionally verifying it against an issuer certificate.
   *
   * @param options X509GetCertificateRevocationListOptions
   */
  public async fetchCertificateRevocationList(options: X509FetchCertificateRevocationListOptions) {
    return await X509RevocationService.fetchCertificateRevocationList(this.agentContext, options)
  }

  /**
   * Parse a base64- or PEM-encoded CRL into an X509CertificateRevocationList.
   *
   * @param options X509ParseCertificateRevocationListOptions
   */
  public parseCertificateRevocationList(options: X509ParseCertificateRevocationListOptions) {
    return X509RevocationService.parseCertificateRevocationList(options)
  }
}
