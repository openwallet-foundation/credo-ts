import type { DidCommV2Message } from './DidCommV2Message'
import type { PlaintextDidCommV2Message } from './types'
import type { AgentMessage } from '../../../agent/AgentMessage'

import { DidCommMessageVersion } from '../../types'

export function isDidCommV2Message(message: AgentMessage): message is DidCommV2Message {
  return message.didCommVersion == DidCommMessageVersion.V2
}

export function isPlaintextMessageV2(message: unknown): message is PlaintextDidCommV2Message {
  if (typeof message !== 'object' || message == null) {
    return false
  }
  // If the message has `type` field we assume the message is in plaintext and it is not encrypted.
  return 'type' in message
}
