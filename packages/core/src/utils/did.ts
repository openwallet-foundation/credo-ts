import { TypedArrayEncoder } from './TypedArrayEncoder'

export function indyDidFromPublicKeyBase58(publicKeyBase58: string): string {
  const buffer = TypedArrayEncoder.fromBase58(publicKeyBase58)

  const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

  return did
}

/**
 * Checks whether `potentialDid` is a valid DID. You can optionally provide a `method` to
 * check whether the did is for that specific method.
 *
 * Note: the check in this method is very simple and just check whether the did starts with
 * `did:` or `did:<method>:`. It does not do an advanced regex check on the did.
 */
export function isDid(potentialDid: string, method?: string) {
  return method ? potentialDid.startsWith(`did:${method}:`) : potentialDid.startsWith('did:')
}
