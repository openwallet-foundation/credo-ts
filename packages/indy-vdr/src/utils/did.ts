import { TypedArrayEncoder } from '@credo-ts/core'

/**
 * Indy uses the first 16 bytes of the Ed25519 public key as the namespace identifier of the did.
 */
export function indyDidFromPublicKeyBase58(publicKeyBase58: string): string {
  const buffer = TypedArrayEncoder.fromBase58(publicKeyBase58)

  const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

  return did
}
