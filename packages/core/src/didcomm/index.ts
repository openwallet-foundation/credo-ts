import type { ParsedMessageType } from '../utils/messageType'
import type { Constructor } from '../utils/mixins'
import type { DidCommV1Message } from './versions/v1'
import type { DidCommV2Message } from './versions/v2'

export * from './versions/v1'
export * from './versions/v2'
export * from './types'
export * from './helpers'

export type ConstructableDidCommMessage = Constructor<DidCommV1Message | DidCommV2Message> & { type: ParsedMessageType }
