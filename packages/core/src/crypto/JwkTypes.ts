export interface Jwk {
  kty: 'EC' | 'OKP'
  crv: 'Ed25519' | 'X25519' | 'P-256' | 'P-384' | 'secp256k1'
  x: string
  y?: string
}
