import type { Key } from '../../../crypto'

export { DidCommV1Message, AgentMessage } from './DidCommV1Message'
export { DidCommV1BaseMessage, DidComV1BaseMessageConstructor } from './DidCommV1BaseMessage'

export interface DidCommV1PackMessageParams {
  recipientKeys: Key[]
  routingKeys: Key[]
  senderKey: Key | null
}

export { isPlaintextMessageV1, isDidCommV1Message, isDidCommV1EncryptedEnvelope } from './helpers'
export { DidCommV1Algorithms, DidCommV1Types, PlaintextDidCommV1Message } from './types'
