import type { DidCommPlaintextMessage } from '../types'

export function getThreadIdFromPlainTextMessage(message: DidCommPlaintextMessage) {
  return message['~thread']?.thid ?? message['@id']
}
