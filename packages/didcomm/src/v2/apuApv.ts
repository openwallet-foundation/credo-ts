import { Hasher, TypedArrayEncoder } from '@credo-ts/core'

export function computeApu(skid: string): Uint8Array {
  return TypedArrayEncoder.fromUtf8String(skid)
}

export function computeApv(recipientKids: string[]): Uint8Array {
  const sortedJoined = [...recipientKids].sort().join('.')
  return Hasher.hash(sortedJoined, 'sha-256')
}
