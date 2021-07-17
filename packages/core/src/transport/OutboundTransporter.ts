import type { Agent } from '../agent/Agent'
import type { OutboundPackage } from '../types'

export interface OutboundTransporter {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  start(agent: Agent): Promise<void>
  stop(): Promise<void>
}
