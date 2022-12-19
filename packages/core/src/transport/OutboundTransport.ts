import type { Agent } from '../agent/Agent'
import type { OutboundPackage } from '../types'

export interface OutboundTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start(agent: Agent<any>): Promise<void>
  stop(): Promise<void>
}
