import { OutboundPackage } from '../types'

export interface OutboundTransporter {
  supportedSchemes: string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMessage(outboundPackage: OutboundPackage): Promise<any>

  start(): Promise<void>
  stop(): Promise<void>
}
