import type { Key } from '../../../crypto'
import type { EnvelopeType } from '../../types'

export { DidCommV1Message } from './DidCommV1Message'
export { DidCommV1BaseMessage, DidComV1BaseMessageConstructor } from './DidCommV1BaseMessage'

export interface PackMessageParams {
  recipientKeys: Key[]
  routingKeys: Key[]
  senderKey: Key | null
  envelopeType?: EnvelopeType
}

export { isPlaintextMessageV1 } from './helpers'
export { isDidCommV1Message } from './helpers'
export { DidCommV1Algorithms } from './types'
export { DidCommV1Types } from './types'
export { PlaintextDidCommV1Message } from './types'
