import type { AgentContext } from '../../../agent'

export interface InboundTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start(agent: AgentContext): Promise<void>
  stop(): Promise<void>
}
