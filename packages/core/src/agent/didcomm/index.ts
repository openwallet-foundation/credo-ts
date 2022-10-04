import type { ParsedMessageType } from '../../utils/messageType'
import type { Constructor } from '../../utils/mixins'
import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

export { DIDCommMessage } from './DIDCommMessage'
export { DIDCommV1Message } from './v1/DIDCommV1Message'
export { DIDCommV2Message } from './v2/DIDCommV2Message'
export { DIDCommV1BaseMessage } from './v1/DIDCommV1BaseMessage'
export { DIDCommV2BaseMessage, DIDCommV2MessageParams } from './v2/DIDCommV2BaseMessage'
export { EncryptedMessage, SignedMessage } from './types'

export type ConstructableDIDCommMessage = Constructor<DIDCommV1Message | DIDCommV2Message> & { type: ParsedMessageType }
export type DIDCommMessageClass = typeof DIDCommV1Message | typeof DIDCommV2Message
