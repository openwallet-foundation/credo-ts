import { OutboundPackage } from '../types'

export interface OutboundTransporter {
  supportedSchemes: string[]

  sendMessage(outboundPackage: OutboundPackage): Promise<any>
}
