import type { DidCommEncryptedMessage } from '../types'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export function isValidJweStructure(message: any): message is DidCommEncryptedMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      message !== null &&
      typeof message.protected === 'string' &&
      message.iv &&
      message.ciphertext &&
      message.tag
  )
}
