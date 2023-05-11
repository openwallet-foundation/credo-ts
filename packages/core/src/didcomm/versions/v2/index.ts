import type { EnvelopeType } from '../../types'

export { DidCommV2Message } from './DidCommV2Message'
export { DidCommV2BaseMessage, DidComV2BaseMessageConstructor, DidCommV2MessageParams } from './DidCommV2BaseMessage'

export interface V2PackMessageParams {
  toDid?: string
  fromDid?: string
  signByDid?: string
  serviceId?: string
  wrapIntoForward?: boolean
  envelopeType?: EnvelopeType
}

export { isPlaintextMessageV2 } from './helpers'
export { isDidCommV2Message } from './helpers'
export { PlaintextDidCommV2Message } from './types'
