import type { AgentContext } from '@credo-ts/core'
import type { OutboundDidCommPackage } from '../types'

export interface OutboundDidCommTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundDidCommPackage): Promise<void>

  start(agentContext: AgentContext): Promise<void>
  stop(): Promise<void>
}
