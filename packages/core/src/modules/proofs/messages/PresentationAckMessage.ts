import type { ProtocolVersion } from '../../../types'
import type { AckMessageOptions } from '../../common'

export type PresentationAckMessageOptions = AckMessageOptions

type PresentationAckMessageType = `https://didcomm.org/present-proof/${ProtocolVersion}/ack`

export interface PresentationAckMessage {
  type: PresentationAckMessageType
}
