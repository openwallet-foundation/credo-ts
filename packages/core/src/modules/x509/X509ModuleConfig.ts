import { defaultX509ParseOptions } from './utils/parseOptions'
import { X509Certificate } from './X509Certificate'
import type { X509ParseOptions } from './X509ServiceOptions'
import {
  withX509RevocationCheckDefaults,
  type X509RevocationCheckOptions,
  type X509RevocationCheckOptionsWithDefaults,
} from './X509ValidationOptions'

export type X509VerificationTrustedCertificates = {
  issuance: string[]
  status?: string[]
}

export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: Array<string | X509Certificate>

  /**
   * Configuration for certificate revocation checking. Options that are not set use
   * {@link defaultX509RevocationCheckOptions}: `SoftFail` (do not fail on network error) for the
   * leaf and all intermediate CAs, a 5 second timeout, a 10 MB CRL size limit and a 1 hour cache.
   */
  revocationCheck?: X509RevocationCheckOptions

  /**
   * Resource limits applied when parsing DER/ASN.1 input, to bound the work done on untrusted
   * input. Replaces {@link defaultX509ParseOptions} in full rather than being merged with it, so
   * any limit left unset here falls back to the underlying parser default instead of Credo's.
   *
   * NOTE: this only applies to parsing performed by the X.509 module's own services (such as
   * `X509Service` and revocation checking). Certificates parsed elsewhere in the agent, for
   * example from an `x5c` header while verifying an SD-JWT VC or mdoc, do not have access to this
   * config and use {@link defaultX509ParseOptions}. Pass `parseOptions` to `X509Certificate` and
   * the other parsing factories directly to control those.
   */
  parseOptions?: X509ParseOptions
}

export class X509ModuleConfig {
  #trustedCertificates?: X509Certificate[]
  #revocationCheck?: X509RevocationCheckOptions
  #parseOptions: X509ParseOptions

  public constructor(options?: X509ModuleConfigOptions) {
    // NOTE: must be set before the trusted certificates are parsed below
    this.#parseOptions = options?.parseOptions ?? defaultX509ParseOptions

    this.setTrustedCertificates(options?.trustedCertificates)
    if (options?.revocationCheck) {
      this.#revocationCheck = options.revocationCheck
    }
  }

  public get trustedCertificates() {
    // TODO: we should probably update this API to return the instances, but don't want to
    // break too much now
    return this.#trustedCertificates?.map((cert) => cert.toString('pem'))
  }

  public get revocationCheck(): X509RevocationCheckOptionsWithDefaults {
    return withX509RevocationCheckDefaults(this.#revocationCheck)
  }

  public setRevocationCheck(options?: X509RevocationCheckOptions) {
    this.#revocationCheck = options
  }

  public get parseOptions(): X509ParseOptions {
    return this.#parseOptions
  }

  /**
   * Set the parse options, or restore {@link defaultX509ParseOptions} when passing `undefined`.
   */
  public setParseOptions(options?: X509ParseOptions) {
    this.#parseOptions = options ?? defaultX509ParseOptions
  }

  public setTrustedCertificates(trustedCertificates?: Array<string | X509Certificate>) {
    const certificateInstances = trustedCertificates?.map((trustedCertificate) =>
      typeof trustedCertificate === 'string'
        ? X509Certificate.fromEncodedCertificate(trustedCertificate, this.#parseOptions)
        : trustedCertificate
    )
    this.#trustedCertificates = trustedCertificates?.length ? certificateInstances : undefined
  }

  public addTrustedCertificate(trustedCertificate: string | X509Certificate) {
    const certificateInstance =
      typeof trustedCertificate === 'string'
        ? X509Certificate.fromEncodedCertificate(trustedCertificate, this.#parseOptions)
        : trustedCertificate

    if (!this.#trustedCertificates) {
      this.#trustedCertificates = []
    }

    this.#trustedCertificates.push(certificateInstance)
  }
}
