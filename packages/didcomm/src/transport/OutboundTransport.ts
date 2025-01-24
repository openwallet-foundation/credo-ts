import type { OutboundPackage } from '../types'
import type { AgentContext } from '@credo-ts/core'

export interface OutboundTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start(agentContext: AgentContext): Promise<void>
  stop(): Promise<void>
}
