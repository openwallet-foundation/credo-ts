import type { EncryptedMessage } from '../agent/didcomm/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidJwsStructure(message: any): message is EncryptedMessage {
  return message && typeof message === 'object' && message.signatures && message.payload
}
