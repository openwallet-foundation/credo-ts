import type { EncryptedDidCommMessage } from '../types'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isValidJweStructure(message: any): message is EncryptedDidCommMessage {
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
