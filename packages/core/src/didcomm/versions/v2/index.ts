import type { AgentContext } from '../../../agent/context/AgentContext'
import type { DecryptedMessageContext, EncryptedMessage, SignedMessage, EnvelopeType } from '../../types'
import type { DidCommV2Message } from './DidCommV2Message'

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

export const DidCommV2EnvelopeServiceToken = Symbol('DidCommV2EnvelopeService')
export const DefaultDidCommV2EnvelopeService = 'default'

export interface DidCommV2EnvelopeService {
  packMessage(
    agentContext: AgentContext,
    payload: DidCommV2Message,
    params: V2PackMessageParams
  ): Promise<EncryptedMessage>

  unpackMessage(agentContext: AgentContext, message: EncryptedMessage | SignedMessage): Promise<DecryptedMessageContext>
}
export { isPlaintextMessageV2 } from './helpers'
export { isDidCommV2Message } from './helpers'
export { PlaintextDidCommV2Message } from './types'
