import type { AgentContext } from '../../../agent/context'
import type { Key } from '../../../crypto'
import type { DecryptedMessageContext, EncryptedMessage, SignedMessage, EnvelopeType } from '../../types'
import type { DidCommV1Message } from './DidCommV1Message'

export { DidCommV1Message } from './DidCommV1Message'
export { DidCommV1BaseMessage, DidComV1BaseMessageConstructor } from './DidCommV1BaseMessage'

export interface PackMessageParams {
  recipientKeys: Key[]
  routingKeys: Key[]
  senderKey: Key | null
  envelopeType?: EnvelopeType
}

export const DidCommV1EnvelopeServiceToken = Symbol('DidCommV1EnvelopeService')

export interface DidCommV1EnvelopeService {
  packMessage(agentContext: AgentContext, payload: DidCommV1Message, keys: PackMessageParams): Promise<EncryptedMessage>

  unpackMessage(agentContext: AgentContext, message: EncryptedMessage | SignedMessage): Promise<DecryptedMessageContext>
}
export { isPlaintextMessageV1 } from './helpers'
export { isDidCommV1Message } from './helpers'
export { DidCommV1Algorithms } from './types'
export { DidCommV1Types } from './types'
export { PlaintextDidCommV1Message } from './types'
