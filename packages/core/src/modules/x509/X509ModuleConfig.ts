export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: [string, ...string[]]
}

export class X509ModuleConfig {
  private options: X509ModuleConfigOptions

  public constructor(options?: X509ModuleConfigOptions) {
    this.options = options?.trustedCertificates ? { trustedCertificates: [...options.trustedCertificates] } : {}
  }

  public get trustedCertificates() {
    return this.options.trustedCertificates
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
