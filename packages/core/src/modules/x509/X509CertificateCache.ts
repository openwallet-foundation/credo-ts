import type { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import { TypedArrayEncoder } from '../../utils/TypedArrayEncoder'
import { LruCache } from '../cache/LruCache'
import { defaultX509ParseOptions } from './utils/parseOptions'
import { X509Certificate } from './X509Certificate'
import { X509ModuleConfig } from './X509ModuleConfig'
import type { EncodedX509Certificate, X509ParseOptions } from './X509ServiceOptions'

// Larger encodings are not cached, which bounds the memory an entry can hold
const maxCachedEncodingLength = 16 * 1024

/**
 * Keeps the parsed certificates of an agent. Registered once per agent, and shared by its tenants: an
 * entry only depends on the encoding and the parse options, and it is cloned before it is returned,
 * so a caller can't change what other callers get.
 *
 * @internal
 */
@injectable()
export class X509CertificateCache {
  private cache?: { limit: number; entries: LruCache<X509Certificate> }

  /**
   * Parses a certificate, or reuses the parsed certificate for the exact same encoding and parse options.
   * Uses the `parseOptions` of the X.509 module when none are passed. An instance is returned as is.
   */
  public static parseCertificate(
    agentContext: AgentContext,
    certificate: EncodedX509Certificate | Uint8Array | X509Certificate,
    parseOptions?: X509ParseOptions
  ): X509Certificate {
    if (certificate instanceof X509Certificate) return certificate

    const config = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const cache = agentContext.dependencyManager.resolve(X509CertificateCache)

    return cache.parseCertificate(certificate, parseOptions ?? config.parseOptions, config.parsedCertificateCacheLimit)
  }

  private parseCertificate(
    certificate: EncodedX509Certificate | Uint8Array,
    parseOptions: X509ParseOptions,
    limit: number
  ): X509Certificate {
    const parse = () =>
      typeof certificate === 'string'
        ? X509Certificate.fromEncodedCertificate(certificate, parseOptions)
        : // Parse a copy, as the parsed certificate keeps a reference to the bytes it was parsed from
          X509Certificate.fromRawCertificate(certificate.slice(), parseOptions)

    if (limit <= 0) return parse()

    // Checked on the bytes, so a large certificate is not encoded first. Base64 is 4 characters per 3 bytes
    const isTooLarge =
      typeof certificate === 'string'
        ? certificate.length > maxCachedEncodingLength
        : certificate.length > (maxCachedEncodingLength / 4) * 3
    if (isTooLarge) return parse()

    const encoding = typeof certificate === 'string' ? certificate : TypedArrayEncoder.toBase64(certificate)

    // Another limit empties the cache
    if (this.cache?.limit !== limit) {
      this.cache = { limit, entries: new LruCache({ limit }) }
    }

    // A certificate parsed with other limits is not reused, as it may not parse within these limits
    // The keys are sorted, so the same options in another order give the same key
    const cacheKey =
      parseOptions === defaultX509ParseOptions
        ? encoding
        : `${JSON.stringify(parseOptions, Object.keys(parseOptions).sort())}:${encoding}`

    let parsed = this.cache.entries.get(cacheKey)
    if (!parsed) {
      parsed = parse()
      this.cache.entries.set(cacheKey, parsed)
    }

    // Every caller gets its own instance, as the key id can be set on it
    return parsed.clone()
  }
}
