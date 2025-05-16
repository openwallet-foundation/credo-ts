import { KnownJwaSignatureAlgorithm, KnownJwaSignatureAlgorithms } from '../kms'

export type MdocSupportedSignatureAlgorithm = (typeof mdocSupporteSignatureAlgorithms)[number]
export const mdocSupporteSignatureAlgorithms = [
  KnownJwaSignatureAlgorithms.ES256,
  KnownJwaSignatureAlgorithms.ES384,
  KnownJwaSignatureAlgorithms.ES512,
  KnownJwaSignatureAlgorithms.EdDSA,
] satisfies KnownJwaSignatureAlgorithm[]

export function isMdocSupportedSignatureAlgorithm(
  alg: KnownJwaSignatureAlgorithm
): alg is MdocSupportedSignatureAlgorithm {
  return mdocSupporteSignatureAlgorithms.includes(alg as MdocSupportedSignatureAlgorithm)
}
