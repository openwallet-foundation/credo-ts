import * as v from '../../../utils/valibot'

export const vKnownJwaSignatureAlgorithm = v.picklist([
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
  'EdDSA',
  'ES256K',
])
export type KnownJwaSignatureAlgorithm = v.InferOutput<typeof vKnownJwaSignatureAlgorithm>

export const vJwaSignatureAlgorithm = v.union([
  vKnownJwaSignatureAlgorithm,
  v.pipe(
    v.string(),
    v.check((alg) => alg !== 'none', 'none is not allowed as signature algorithm')
  ),
])
export type JwaSignatureAlgorithm = v.InferOutput<typeof vJwaSignatureAlgorithm>
