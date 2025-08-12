import type { AgentContext } from '@credo-ts/core'

export interface InboundDidCommTransport {
  start(agent: AgentContext): Promise<void>
  stop(): Promise<void>
}
