import type { AgentMessage } from '../../../agent/AgentMessage'
import type { EncryptedMessage, ProtectedMessage } from '../../types'
import type { DidCommV1Message } from './DidCommV1Message'
import type { PlaintextDidCommV1Message } from './types'

import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils'
import { DidCommMessageVersion } from '../../types'

import { DidCommV1Algorithms, DidCommV1Types } from './types'

export function isDidCommV1Message(message: AgentMessage): message is DidCommV1Message {
  return message.didCommVersion == DidCommMessageVersion.V1
}

export function isPlaintextMessageV1(message: unknown): message is PlaintextDidCommV1Message {
  if (typeof message !== 'object' || message == null) {
    return false
  }
  // If the message has `@type` field we assume the message is in plaintext and it is not encrypted.
  return '@type' in message
}

export function isDidCommV1EncryptedEnvelope(message: EncryptedMessage): boolean {
  const protectedValue = JsonEncoder.fromBase64(message.protected) as ProtectedMessage
  if (!protectedValue) {
    throw new AriesFrameworkError(`Unable to unpack message, missing value for \`protected\` property`)
  }

  return (
    protectedValue.typ === DidCommV1Types.JwmV1 &&
    (protectedValue.alg === DidCommV1Algorithms.Anoncrypt || protectedValue.alg === DidCommV1Algorithms.Authcrypt)
  )
}
