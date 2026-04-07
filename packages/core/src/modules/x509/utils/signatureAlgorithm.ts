/**
 * Converts an x509 signatureAlgorithm (HashedAlgorithm) to a JWA algorithm string.
 * Returns undefined for non-RSA algorithms.
 */
export function x509SignatureAlgorithmToJwa(signatureAlgorithm: {
  name?: string
  hash?: { name?: string }
}): string | undefined {
  const hash = signatureAlgorithm.hash?.name
  if (signatureAlgorithm.name === 'RSASSA-PKCS1-v1_5') {
    switch (hash) {
      case 'SHA-256':
        return 'RS256'
      case 'SHA-384':
        return 'RS384'
      case 'SHA-512':
        return 'RS512'
    }
  } else if (signatureAlgorithm.name === 'RSA-PSS') {
    switch (hash) {
      case 'SHA-256':
        return 'PS256'
      case 'SHA-384':
        return 'PS384'
      case 'SHA-512':
        return 'PS512'
    }
  }
  return undefined
}
