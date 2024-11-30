export type { JwaSignatureAlgorithm, KnownJwaSignatureAlgorithm } from './jwa'
export { type KmsJwkPrivate, type KmsJwkPublic, publicJwkFromPrivateJwk } from './knownJwk'

export type { KmsJwkPrivateEc, KmsJwkPublicEc } from './kty/ec'
export type { KmsJwkPrivateOct, KmsJwkPublicOct } from './kty/oct'
export type { KmsJwkPrivateOkp, KmsJwkPublicOkp } from './kty/okp'
export type { KmsJwkPrivateRsa, KmsJwkPublicRsa } from './kty/rsa'

export { Jwk, JwkCommon } from './jwk'
export { keyAllowsSign, keyAllowsVerify, assertKeyAllowsSign, assertKeyAllowsVerify } from './keyOps'
export {
  allowedAlgsForSigningKey,
  getJwkHumanDescription,
  assertAllowedAlgForSigningKey,
  supportedAlgsForSigningKey,
} from './alg'
