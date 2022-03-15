import { KeyType } from './KeyType'

// based on https://github.com/multiformats/multicodec/blob/master/table.csv
const multiCodecPrefixMap: Record<string, KeyType> = {
  234: KeyType.Bls12381g1,
  235: KeyType.Bls12381g2,
  236: KeyType.X25519,
  237: KeyType.Ed25519,
  238: KeyType.Bls12381g1g2,
}

export function getKeyTypeByMultiCodecPrefix(multiCodecPrefix: number): KeyType {
  const keyType = multiCodecPrefixMap[multiCodecPrefix]

  if (!keyType) {
    throw new Error(`Unsupported key type from multicodec code '${multiCodecPrefix}'`)
  }

  return keyType
}

export function getMultiCodecPrefixByKeytype(keyType: KeyType): number {
  const codes = Object.keys(multiCodecPrefixMap)
  const code = codes.find((key) => multiCodecPrefixMap[key] === keyType)

  if (!code) {
    throw new Error(`Could not find multicodec prefix for key type '${keyType}'`)
  }

  return Number(code)
}
