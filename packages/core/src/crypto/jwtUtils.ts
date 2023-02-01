export const jwtKeyAlgMapping = {
  HMAC: ['HS256', 'HS384', 'HS512'],
  RSA: ['RS256', 'RS384', 'RS512'],
  ECDSA: ['ES256', 'ES384', 'ES512'],
  'RSA-PSS': ['PS256', 'PS384', 'PS512'],
  EdDSA: ['Ed25519'],
}

export type JwtAlgorithm = keyof typeof jwtKeyAlgMapping

export function isJwtAlgorithm(value: string): value is JwtAlgorithm {
  return Object.keys(jwtKeyAlgMapping).includes(value)
}
