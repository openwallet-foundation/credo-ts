import type { X509ParseOptions } from '../X509ServiceOptions'

/**
 * The parse options applied when a caller provides none.
 *
 * `asn1js` allows 10.000 ASN.1 nodes by default. A revoked certificate costs three nodes and about
 * 28 bytes of DER, so that default rejects any CRL with more than roughly 3.300 entries, while
 * `fetchCrl` is willing to download a CRL of up to 10 MB (around 375.000 entries, or 1.2 million
 * nodes). Credo therefore raises the node limit to match the CRL size it accepts, keeping it far
 * below what the 16 MB `maxContentLength` default would otherwise allow.
 *
 * The other `asn1js` defaults (`maxDepth` of 100 and a `maxContentLength` of 16 MB) are left
 * alone, as no X.509 structure Credo parses comes close to either.
 */
export const defaultX509ParseOptions: X509ParseOptions = {
  maxNodes: 1_500_000,
}
