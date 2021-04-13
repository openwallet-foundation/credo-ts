import { OutboundPackage } from '../types'

export interface OutboundTransporter {
  sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean): Promise<any>
}
