import { OutboundPackage } from '../types';

export interface OutboundTransporter {
  sendMessage(outboundPackage: OutboundPackage): any;
}
