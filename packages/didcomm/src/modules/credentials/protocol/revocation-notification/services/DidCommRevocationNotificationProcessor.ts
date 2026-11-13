import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import type { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'

export interface DidCommRevocationNotificationProcessor {
  processV1(messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV1Message>): Promise<void>
  processV2(messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV2Message>): Promise<void>
}

export const DidCommRevocationNotificationProcessorToken = Symbol('DidCommRevocationNotificationProcessor')
