import type { JwaCurve, JwaKeyType } from '../jwa'
import type { JwkJson } from './Jwk'

export function hasCrv(jwk: JwkJson, crv: JwaCurve): jwk is JwkJson & { crv: JwaCurve } {
  return 'crv' in jwk && jwk.crv === crv
}

export function hasKty(jwk: JwkJson, kty: JwaKeyType) {
  return 'kty' in jwk && jwk.kty === kty
}

export function hasX(jwk: JwkJson): jwk is JwkJson & { x: string } {
  return 'x' in jwk && jwk.x !== undefined
}

export function hasY(jwk: JwkJson): jwk is JwkJson & { y: string } {
  return 'y' in jwk && jwk.y !== undefined
}

export function hasValidUse(
  jwk: JwkJson,
  { supportsSigning, supportsEncrypting }: { supportsSigning: boolean; supportsEncrypting: boolean }
) {
  return jwk.use === undefined || (supportsSigning && jwk.use === 'sig') || (supportsEncrypting && jwk.use === 'enc')
}
