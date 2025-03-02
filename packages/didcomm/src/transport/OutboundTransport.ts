import type { AgentContext } from '@credo-ts/core'
import type { OutboundPackage } from '../types'

export interface OutboundTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  start(agentContext: AgentContext): Promise<void>
  stop(): Promise<void>
}
