import type { SignedMessage } from '../didcomm/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidJwsStructure(message: any): message is SignedMessage {
  return message && typeof message === 'object' && message.signatures && message.payload
}
