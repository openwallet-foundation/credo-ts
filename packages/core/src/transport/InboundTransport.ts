import type { Agent } from '../agent/Agent'

export interface InboundTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start(agent: Agent<any>): Promise<void>
  stop(): Promise<void>
}
