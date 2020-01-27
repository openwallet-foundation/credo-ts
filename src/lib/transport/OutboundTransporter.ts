import { OutboundPackage } from '../types';

export interface OutboundTransporter {
  sendMessage(outboundPackage: OutboundPackage, receive_reply: boolean): Promise<any>;
}
