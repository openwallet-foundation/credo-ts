import { type KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../kms'

export type MdocSupportedSignatureAlgorithm = (typeof mdocSupportedSignatureAlgorithms)[number]
export const mdocSupportedSignatureAlgorithms = [
  KnownJwaSignatureAlgorithms.ES256,
  KnownJwaSignatureAlgorithms.ES384,
  KnownJwaSignatureAlgorithms.ES512,
  KnownJwaSignatureAlgorithms.EdDSA,
] satisfies KnownJwaSignatureAlgorithm[]

export function isMdocSupportedSignatureAlgorithm(
  alg: KnownJwaSignatureAlgorithm
): alg is MdocSupportedSignatureAlgorithm {
  return mdocSupportedSignatureAlgorithms.includes(alg as MdocSupportedSignatureAlgorithm)
}
