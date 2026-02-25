import type { AgentContext } from '@credo-ts/core'

export interface DidCommInboundTransport {
  start(agent: AgentContext): Promise<void>
  stop(): Promise<void>
}
