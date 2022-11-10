import type {
  EncryptedMessage,
  PlaintextDIDCommV1Message,
  PlaintextDIDCommV2Message,
  PlaintextMessage,
  SignedMessage,
} from './types'

import { isValidJwsStructure } from '../../utils'
import { isValidJweStructure } from '../../utils/JWE'

export function isEncryptedMessage(message: unknown): message is EncryptedMessage {
  // If the message does has valid JWE structure, we can assume the message is encrypted.
  return isValidJweStructure(message)
}

export function isSignedMessage(message: unknown): message is SignedMessage {
  // If the message does has valid JWS structure, we can assume the message is signed.
  return isValidJwsStructure(message)
}

export function getPlaintextMessageType(message: unknown): string | undefined {
  return isPlaintextMessageV1(message) ? message['@type'] : isPlaintextMessageV2(message) ? message.type : undefined
}

export function isPlaintextMessage(message: unknown): message is PlaintextMessage {
  return isPlaintextMessageV1(message) || isPlaintextMessageV2(message)
}

export function isPlaintextMessageV1(message: unknown): message is PlaintextDIDCommV1Message {
  if (typeof message !== 'object' || message == null) {
    return false
  }
  // If the message has @type field we assume the message is in plaintext and it is not encrypted.
  return '@type' in message
}

export function isPlaintextMessageV2(message: unknown): message is PlaintextDIDCommV2Message {
  if (typeof message !== 'object' || message == null) {
    return false
  }
  // If the message has type field we assume the message is in plaintext and it is not encrypted.
  return 'type' in message
}
