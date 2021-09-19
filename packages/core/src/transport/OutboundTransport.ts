import type { Agent } from '../agent/Agent'
import type { OutboundPackage } from '../types'

export interface OutboundTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  start(agent: Agent): Promise<void>
  stop(): Promise<void>
}
