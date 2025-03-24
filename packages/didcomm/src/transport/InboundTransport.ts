import type { AgentContext } from '@credo-ts/core'

export interface InboundTransport {
  start(agent: AgentContext): Promise<void>
  stop(): Promise<void>
}
