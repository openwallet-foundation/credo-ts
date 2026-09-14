/**
 * Helpers for serving the credo-ts verifier over real HTTPS during conformance
 * tests. A single EC P-256 key pair backs both the verifier's x509 request
 * signing certificate and the TLS certificate of the HTTPS server, so the
 * conformance suite sees one consistent key/cert when it validates the request
 * signature and when it fetches the request object.
 */

import { createPrivateKey, generateKeyPairSync } from 'node:crypto'

export interface ConformanceKeyMaterial {
  /** Private JWK to import into the credo-ts KMS for request signing. */
  privateJwk: {
    kty: 'EC'
    crv: 'P-256'
    d: string
    x: string
    y: string
  }
  /** PKCS#8 PEM private key for node's https.createServer. */
  tlsKeyPem: string
}

/**
 * Generates a fresh EC P-256 key pair and returns it both as a private JWK
 * (for the KMS) and as a PKCS#8 PEM (for the TLS server).
 */
export function generateConformanceKeyMaterial(): ConformanceKeyMaterial {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })

  const jwk = privateKey.export({ format: 'jwk' }) as {
    kty: 'EC'
    crv: 'P-256'
    d: string
    x: string
    y: string
  }

  const tlsKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()

  return { privateJwk: jwk, tlsKeyPem }
}

/**
 * Converts a private EC JWK to a PKCS#8 PEM string (used when the key originates
 * outside this helper).
 */
export function privateJwkToPkcs8Pem(jwk: object): string {
  return createPrivateKey({ key: jwk as never, format: 'jwk' })
    .export({ format: 'pem', type: 'pkcs8' })
    .toString()
}
