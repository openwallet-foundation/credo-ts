import type { EncryptedMessage } from '../types'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isValidJweStructure(message: any): message is EncryptedMessage {
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
