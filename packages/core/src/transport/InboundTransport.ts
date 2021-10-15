import type { Agent } from '../agent/Agent'

export interface InboundTransport {
  start(agent: Agent): Promise<void>
  stop(): Promise<void>
}
