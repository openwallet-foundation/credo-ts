import type { EncryptedMessage, PlaintextMessage, SignedMessage } from './types'

import { AriesFrameworkError } from '../error'
import { isValidJwsStructure } from '../utils'
import { isValidJweStructure } from '../utils/JWE'

import { isPlaintextMessageV1 } from './versions/v1'
import { isPlaintextMessageV2 } from './versions/v2'

export function isEncryptedMessage(message: unknown): message is EncryptedMessage {
  // If the message does has valid JWE structure, we can assume the message is encrypted.
  return isValidJweStructure(message)
}

export function isSignedMessage(message: unknown): message is SignedMessage {
  // If the message does has valid JWS structure, we can assume the message is signed.
  return isValidJwsStructure(message)
}

export function getPlaintextMessageType(message: unknown): string {
  if (isPlaintextMessageV1(message)) return message['@type']
  if (isPlaintextMessageV2(message)) return message.type
  throw new AriesFrameworkError(`Unable to get type of the message: ${message}`)
}

export function isPlaintextMessage(message: unknown): message is PlaintextMessage {
  return isPlaintextMessageV1(message) || isPlaintextMessageV2(message)
}
