import { InboundMessage, OutboundMessage } from '../types';

export interface Handler {
  readonly supportedMessageTypes: string[];

  handle(inboundMessage: InboundMessage): Promise<OutboundMessage | null>;
}
