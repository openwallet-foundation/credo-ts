import type { EncryptedMessage } from '../types'

export function isValidJweStucture(message: any): message is EncryptedMessage {
  return message && typeof message === 'object' && message.protected && message.iv && message.ciphertext && message.tag
}
