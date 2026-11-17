import { defaultX509ParseOptions } from './utils/parseOptions'
import { X509Certificate } from './X509Certificate'
import { X509Error } from './X509Error'
import type { X509ParseOptions } from './X509ServiceOptions'
import {
  withX509RevocationCheckDefaults,
  type X509RevocationCheckOptions,
  type X509RevocationCheckOptionsWithDefaults,
} from './X509ValidationOptions'

export type X509VerificationTrustedCertificates = {
  issuance: Array<string | X509Certificate>
  status?: Array<string | X509Certificate>
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

  /**
   * How many parsed certificates the X.509 service of the agent keeps in memory, so a certificate
   * that is seen on every request is parsed once. The least recently used certificate is dropped
   * first. Set to 0 to parse every certificate again.
   *
   * A certificate of more than 12 KB is parsed every time, which bounds the memory an entry can
   * hold. Certificates are usually 0.5 to 2 KB.
   *
   * `X509Certificate` instances are used as they are and do not go through this cache. Pass trusted
   * certificates as instances when there are more of them than this limit.
   *
   * @default 250
   */
  parsedCertificateCacheLimit?: number
}

export class X509ModuleConfig {
  #trustedCertificates?: X509Certificate[]
  #revocationCheck?: X509RevocationCheckOptions
  #parseOptions: X509ParseOptions
  #parsedCertificateCacheLimit: number

  public constructor(options?: X509ModuleConfigOptions) {
    // NOTE: must be set before the trusted certificates are parsed below
    this.#parseOptions = options?.parseOptions ?? defaultX509ParseOptions

    this.setTrustedCertificates(options?.trustedCertificates)
    if (options?.revocationCheck) {
      this.#revocationCheck = options.revocationCheck
    }
    this.#parsedCertificateCacheLimit = 250
    if (options?.parsedCertificateCacheLimit !== undefined) {
      this.setParsedCertificateCacheLimit(options.parsedCertificateCacheLimit)
    }
  }

  public get parsedCertificateCacheLimit() {
    return this.#parsedCertificateCacheLimit
  }

  /**
   * Another limit empties the cache. See {@link X509ModuleConfigOptions.parsedCertificateCacheLimit}.
   */
  public setParsedCertificateCacheLimit(limit: number) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new X509Error(`parsedCertificateCacheLimit must be 0 or a positive integer, received '${limit}'`)
    }

    this.#parsedCertificateCacheLimit = limit
  }

  public get trustedCertificates(): X509Certificate[] | undefined {
    return this.#trustedCertificates && [...this.#trustedCertificates]
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
