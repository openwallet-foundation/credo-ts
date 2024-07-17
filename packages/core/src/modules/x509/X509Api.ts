import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'

import { X509ModuleConfig } from './X509ModuleConfig'
import { X509Service } from './X509Service'
import { X509CreateSelfSignedCertificateOptions, X509ValidateCertificateChainOptions } from './X509ServiceOptions'

/**
 * @public
 */
@injectable()
export class X509Api {
  public constructor(
    private agentContext: AgentContext,
    private x509ModuleConfig: X509ModuleConfig,
    private x509Service: X509Service
  ) {}

  /**
   * Adds a trusted certificate to the X509 Module Config.
   *
   * @param certificate
   */
  public async addTrustedCertificate(certificate: string) {
    this.x509ModuleConfig.addTrustedCertificate(certificate)
  }

  /**
   * Overwrites the trusted certificates in the X509 Module Config.
   *
   * @param certificate
   */
  public async setTrustedCertificates(certificates?: [string, ...string[]]) {
    this.x509ModuleConfig.setTrustedCertificates(certificates)
  }

  /**
   * Creates a self-signed certificate.
   *
   * @param options X509CreateSelfSignedCertificateOptions
   */
  public async createSelfSignedCertificate(options: X509CreateSelfSignedCertificateOptions) {
    return await X509Service.createSelfSignedCertificate(this.agentContext, options)
  }

  /**
   * Validate a certificate chain.
   *
   * @param options X509ValidateCertificateChainOptions
   */
  public async validateCertificateChain(options: X509ValidateCertificateChainOptions) {
    return await X509Service.validateCertificateChain(this.agentContext, options)
  }
}
