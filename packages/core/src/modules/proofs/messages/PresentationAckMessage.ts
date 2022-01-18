import type { AckMessageOptions } from '../../common'
import type { ProtocolVersion } from 'packages/core/src/types'

export type PresentationAckMessageOptions = AckMessageOptions

type PresentationAckMessageType = `https://didcomm.org/present-proof/${ProtocolVersion}/ack`

export interface PresentationAckMessage {
  type: PresentationAckMessageType
}
