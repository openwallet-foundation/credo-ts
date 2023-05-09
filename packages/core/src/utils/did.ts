import { TypedArrayEncoder } from './TypedArrayEncoder'

export function indyDidFromPublicKeyBase58(publicKeyBase58: string): string {
  const buffer = TypedArrayEncoder.fromBase58(publicKeyBase58)

  const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

  return did
}
