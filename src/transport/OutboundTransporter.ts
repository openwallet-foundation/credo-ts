import type { OutboundPackage } from '../types'

export interface OutboundTransporter {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<void>

  start(): Promise<void>
  stop(): Promise<void>
}
