import type { EncryptedMessage } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidJweStructure(message: any): message is EncryptedMessage {
  return message && typeof message === 'object' && message.protected && message.iv && message.ciphertext && message.tag
}
