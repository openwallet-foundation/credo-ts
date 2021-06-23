import type { ConnectionRecord } from '../modules/connections'
import type { OutboundMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T
): OutboundMessage<T> {
  return {
    connection,
    payload,
  }
}
