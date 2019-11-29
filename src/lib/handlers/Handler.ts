import { InboundMessage, OutboundMessage } from '../types';

export interface Handler {
  handle(inboudMessage: InboundMessage): Promise<OutboundMessage | null>;
}
