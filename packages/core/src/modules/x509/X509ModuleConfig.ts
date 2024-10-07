import type { AgentContext } from '../../agent'

type GetTrustedCertificatesForProofOptions = {
  proofRecordId?: string
  correlationId?: string
}

export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: [string, ...string[]]

  getTrustedCertificatesForProof?(
    agentContext: AgentContext,
    options: GetTrustedCertificatesForProofOptions
  ): Promise<[string, ...string[]] | undefined>
}

export class X509ModuleConfig {
  private options: X509ModuleConfigOptions

  public constructor(options?: X509ModuleConfigOptions) {
    this.options = options?.trustedCertificates ? { trustedCertificates: [...options.trustedCertificates] } : {}
    this.options.getTrustedCertificatesForProof = options?.getTrustedCertificatesForProof
  }

  public get trustedCertificates() {
    return this.options.trustedCertificates
  }

  public get getTrustedCertificatesForProof() {
    return this.options.getTrustedCertificatesForProof
  }

  public setTrustedCertificatesForProof(fn: X509ModuleConfigOptions['getTrustedCertificatesForProof']) {
    this.options.getTrustedCertificatesForProof = fn
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
