import type { AgentContext } from '../../agent'
import type { VerificationContext } from '../vc'

export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: [string, ...string[]]

  /**
   * Optional callback method that will be called to dynamically get trusted certificates for a verification.
   * It will always provide the `agentContext` allowing to dynamically set the trusted certificates for a tenant.
   * If available the associated record id is also provided allowing to filter down trusted certificates to a single
   * exchange.
   *
   * @returns An array of base64-encoded certificate strings or PEM certificate strings.
   */
  getTrustedCertificatesForVerification?(
    agentContext: AgentContext,
    verificationContext?: VerificationContext
  ): Promise<[string, ...string[]] | undefined>
}

export class X509ModuleConfig {
  private options: X509ModuleConfigOptions

  public constructor(options?: X509ModuleConfigOptions) {
    this.options = options?.trustedCertificates ? { trustedCertificates: [...options.trustedCertificates] } : {}
    this.options.getTrustedCertificatesForVerification = options?.getTrustedCertificatesForVerification
  }

  public get trustedCertificates() {
    return this.options.trustedCertificates
  }

  public get getTrustedCertificatesForVerification() {
    return this.options.getTrustedCertificatesForVerification
  }

  public setTrustedCertificatesForVerification(fn: X509ModuleConfigOptions['getTrustedCertificatesForVerification']) {
    this.options.getTrustedCertificatesForVerification = fn
  }

  public setTrustedCertificates(trustedCertificates?: [string, ...string[]]) {
    this.options.trustedCertificates = trustedCertificates ? [...trustedCertificates] : undefined
  }

  public addTrustedCertificate(trustedCertificate: string) {
    if (!this.options.trustedCertificates) {
      this.options.trustedCertificates = [trustedCertificate]
      return
    }
    this.options.trustedCertificates.push(trustedCertificate)
  }
}
