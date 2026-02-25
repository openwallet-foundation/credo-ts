import type { Uint8ArrayBuffer } from '@credo-ts/core'
import { CryptoBox } from '@openwallet-foundation/askar-shared'

export function randomBytes(length: number): Uint8ArrayBuffer {
  const buffer = new Uint8Array(length)
  const CBOX_NONCE_LENGTH = 24

  const genCount = Math.ceil(length / CBOX_NONCE_LENGTH)
  const buf = new Uint8Array(genCount * CBOX_NONCE_LENGTH)
  for (let i = 0; i < genCount; i++) {
    const randomBytes = CryptoBox.randomNonce()
    buf.set(randomBytes, CBOX_NONCE_LENGTH * i)
  }
  buffer.set(buf.subarray(0, length))

  return buffer
}
