import type { PlaintextDidCommMessage } from '../types'

export function getThreadIdFromPlainTextMessage(message: PlaintextDidCommMessage) {
  return message['~thread']?.thid ?? message['@id']
}
