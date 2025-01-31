import { JwaSignatureAlgorithm } from '../../crypto'

export type MdocSupportedSignatureAlgorithm = (typeof mdocSupporteSignatureAlgorithms)[number]
export const mdocSupporteSignatureAlgorithms = [
  JwaSignatureAlgorithm.ES256,
  JwaSignatureAlgorithm.ES384,
  JwaSignatureAlgorithm.ES512,
  JwaSignatureAlgorithm.EdDSA,
] satisfies JwaSignatureAlgorithm[]

export function isMdocSupportedSignatureAlgorithm(alg: JwaSignatureAlgorithm): alg is MdocSupportedSignatureAlgorithm {
  return mdocSupporteSignatureAlgorithms.includes(alg as MdocSupportedSignatureAlgorithm)
}
